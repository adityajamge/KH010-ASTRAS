"""Mediation workflow persistence (PS14 §§16, 20–21).

Runs the deterministic allocation engine over a canal's open requests and
persists the outcome: allocations, schedules, conflicts + participants,
notifications, objections, and versioned agreements. Every number shown to a
farmer originates from :mod:`app.services.allocation`, never from ad-hoc
arithmetic in the endpoints.
"""

from __future__ import annotations

from datetime import date, time

from sqlalchemy.orm import Session

from app.core.auth import AuthUser
from app.models.conflict import (
    Agreement,
    Conflict,
    ConflictParticipant,
    Objection,
)
from app.models.enums import (
    ActorType,
    AgreementStatus,
    AllocationStatus,
    ConflictStatus,
    DeliveryStatus,
    NotificationSeverity,
    ObjectionReason,
    ObjectionStatus,
    PriorityLevel,
    RequestStatus,
    ScheduleStatus,
)
from app.models.farmer import Farmer
from app.models.network import Canal
from app.models.request import Allocation, Delivery, Schedule, WaterRequest
from app.models.system import AuditLog, Notification
from app.services.allocation import (
    DAY_START,
    Claim,
    EngineOutcome,
    allocate,
    build_reason,
    plan_slots,
)
from app.services.mediation_agent import mediate_objection

#: Human-readable labels for the mediation agent's prompt (PS14 §16/§21).
_OBJECTION_REASON_LABEL: dict[ObjectionReason, str] = {
    ObjectionReason.NEED_MORE_WATER: "Need more water",
    ObjectionReason.NEED_DIFFERENT_TIME: "Need a different time slot",
    ObjectionReason.CROP_CRITICAL: "Crop is in a critical stage",
    ObjectionReason.EMERGENCY: "Emergency",
    ObjectionReason.OTHER: "Other",
}

#: Request states that still take part in an allocation round.
OPEN_REQUEST_STATUSES = (
    RequestStatus.PENDING,
    RequestStatus.PROCESSING,
    RequestStatus.PROPOSED,
)

#: Allocation states an engine round is allowed to overwrite.
REWRITABLE_ALLOCATION_STATUSES = (
    AllocationStatus.PENDING,
    AllocationStatus.PROPOSED,
    AllocationStatus.MODIFIED,
)

_URGENCY_BOOST: dict[PriorityLevel, PriorityLevel] = {
    PriorityLevel.NORMAL: PriorityLevel.HIGH,
    PriorityLevel.HIGH: PriorityLevel.CRITICAL,
    PriorityLevel.CRITICAL: PriorityLevel.CRITICAL,
}


def notify(
    db: Session,
    farmer_id: int,
    title: str,
    message: str,
    severity: NotificationSeverity = NotificationSeverity.INFO,
) -> Notification:
    row = Notification(
        farmer_id=farmer_id, title=title, message=message, type=severity
    )
    db.add(row)
    return row


def audit(
    db: Session,
    action: str,
    entity_type: str,
    entity_id: str,
    actor_type: ActorType = ActorType.SYSTEM,
    actor_id: str | None = None,
    details: dict | None = None,
) -> AuditLog:
    row = AuditLog(
        actor_type=actor_type,
        actor_id=actor_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details,
    )
    db.add(row)
    return row


def canal_available_water(canal: Canal) -> float:
    """Water available for allocation on a canal.

    Canal capacity caps the flow, so ``min`` enforces the capacity
    constraint (PS14 §13) by construction.
    """
    return max(0.0, min(float(canal.current_flow), float(canal.capacity)))


def open_claims(db: Session, canal_id: int) -> tuple[list[Claim], dict[int, WaterRequest]]:
    """Open requests from farmers on ``canal_id``, oldest first."""
    rows = (
        db.query(WaterRequest)
        .join(Farmer, WaterRequest.farmer_id == Farmer.id)
        .filter(
            Farmer.canal_id == canal_id,
            WaterRequest.status.in_(OPEN_REQUEST_STATUSES),
        )
        .order_by(WaterRequest.id)
        .all()
    )
    claims = [
        Claim(
            farmer_id=r.farmer_id,
            request_id=r.id,
            requested=float(r.quantity_requested),
            urgency=r.urgency,
        )
        for r in rows
    ]
    return claims, {r.id: r for r in rows}


def open_conflict(db: Session, canal_id: int) -> Conflict | None:
    return (
        db.query(Conflict)
        .filter(
            Conflict.canal_id == canal_id,
            Conflict.status.in_(
                (ConflictStatus.DETECTED, ConflictStatus.UNDER_REVIEW, ConflictStatus.NEGOTIATION)
            ),
        )
        .order_by(Conflict.id.desc())
        .first()
    )


def _sync_participants(db: Session, conflict: Conflict, farmer_ids: list[int]) -> None:
    existing = {
        p.farmer_id
        for p in db.query(ConflictParticipant)
        .filter(ConflictParticipant.conflict_id == conflict.id)
        .all()
    }
    for fid in farmer_ids:
        if fid not in existing:
            db.add(ConflictParticipant(conflict_id=conflict.id, farmer_id=fid))


def _proposal_text(db: Session, allocations: dict[int, float], requests: dict[int, WaterRequest]) -> str:
    parts = []
    for rid, qty in sorted(allocations.items()):
        req = requests[rid]
        farmer = db.get(Farmer, req.farmer_id)
        name = farmer.name if farmer else f"#{req.farmer_id}"
        parts.append(f"{name} → {qty:.2f}")
    return ", ".join(parts)


def run_allocation_cycle(
    db: Session, canal: Canal, actor_id: str | None = None
) -> EngineOutcome:
    """Recompute allocations for every open request on a canal and persist."""
    available = canal_available_water(canal)
    claims, requests = open_claims(db, canal.id)
    outcome = allocate(available, claims)

    # Persist per-request allocations + request states.
    active: list[tuple[WaterRequest, Allocation]] = []
    for claim in claims:
        req = requests[claim.request_id]
        qty = outcome.allocations[claim.request_id]
        allocation = (
            db.query(Allocation)
            .filter(
                Allocation.request_id == req.id,
                Allocation.status.in_(REWRITABLE_ALLOCATION_STATUSES),
            )
            .order_by(Allocation.id.desc())
            .first()
        )
        is_new = allocation is None
        previous = 0.0 if is_new else float(allocation.allocated_quantity)
        if is_new:
            allocation = Allocation(
                request_id=req.id,
                farmer_id=req.farmer_id,
                allocated_quantity=qty,
                allocation_date=req.request_date,
                # Real slot times are assigned by _regenerate_schedules below.
                time_start=time(6, 0),
                time_end=time(6, 0),
                status=AllocationStatus.PROPOSED,
            )
            db.add(allocation)
            db.flush()
        else:
            allocation.allocated_quantity = qty
            allocation.allocation_date = req.request_date
            allocation.status = AllocationStatus.PROPOSED
            db.flush()
        allocation.reason = build_reason(float(req.quantity_requested), qty, outcome)
        req.status = RequestStatus.PROPOSED
        active.append((req, allocation))

        # Delivery row tracks actuals against this allocation; never overwrite
        # readings that already exist.
        if (
            db.query(Delivery)
            .filter(Delivery.allocation_id == allocation.id)
            .first()
            is None
        ):
            db.add(
                Delivery(
                    allocation_id=allocation.id,
                    allocated_quantity=qty,
                    delivered_quantity=0,
                    delivery_status=DeliveryStatus.ON_TRACK,
                )
            )

        if is_new or abs(previous - qty) > 0.005:
            notify(
                db,
                req.farmer_id,
                f"Allocation proposed: {qty:.0f} of {float(req.quantity_requested):.0f} units",
                allocation.reason or "",
                NotificationSeverity.WARNING if outcome.has_conflict else NotificationSeverity.INFO,
            )

    # Regenerate schedules per date so slots stay sequential and conflict-free.
    _regenerate_schedules(db, canal, active)
    for req, allocation in active:
        sched = (
            db.query(Schedule)
            .filter(Schedule.allocation_id == allocation.id)
            .order_by(Schedule.id)
            .first()
        )
        if sched is not None:
            notify(
                db,
                req.farmer_id,
                f"Schedule confirmed for {sched.date.isoformat()}, "
                f"{sched.start_time.strftime('%H:%M')}–{sched.end_time.strftime('%H:%M')}",
                f"{float(sched.quantity):.0f} units on canal {canal.name}.",
            )

    _sync_conflict(db, canal, outcome, claims, requests, actor_id)
    db.flush()
    return outcome


def _regenerate_schedules(
    db: Session, canal: Canal, active: list[tuple[WaterRequest, Allocation]]
) -> None:
    by_date: dict[date, list[tuple[int, int, float]]] = {}
    alloc_by_request = {req.id: alloc for req, alloc in active}
    for req, _alloc in active:
        by_date.setdefault(req.request_date, []).append(
            (req.id, req.farmer_id, float(alloc_by_request[req.id].allocated_quantity))
        )
    for slot_date in by_date:
        by_date[slot_date].sort(key=lambda item: item[0])
    for req, alloc in active:
        db.query(Schedule).filter(
            Schedule.allocation_id == alloc.id,
            Schedule.status.in_((ScheduleStatus.PENDING, ScheduleStatus.SCHEDULED)),
        ).delete(synchronize_session=False)
    db.flush()
    for slot_date, items in sorted(by_date.items()):
        start = _next_free_slot_start(db, canal, slot_date)
        for slot in plan_slots(slot_date, items, start=start):
            alloc = alloc_by_request[slot.request_id]
            db.add(
                Schedule(
                    farmer_id=slot.farmer_id,
                    allocation_id=alloc.id,
                    date=slot_date,
                    start_time=slot.start,
                    end_time=slot.end,
                    quantity=slot.quantity,
                    status=ScheduleStatus.SCHEDULED,
                )
            )
            # Each allocation carries its own slot window for quick reads.
            alloc.time_start = slot.start
            alloc.time_end = slot.end


def _next_free_slot_start(db: Session, canal: Canal, slot_date: date) -> time:
    """Where this round's newly (re)planned slots should begin.

    Only the requests being regenerated this round are deleted and re-laid
    out from DAY_START above — an already-accepted allocation from an
    earlier round keeps its schedule row untouched. Without this, a new
    round would restart at DAY_START too and overlap that earlier slot.
    Queuing after the latest end time already booked on this canal/date
    keeps every slot on a canal sequential and non-overlapping.
    """
    latest_end = (
        db.query(Schedule.end_time)
        .join(Farmer, Schedule.farmer_id == Farmer.id)
        .filter(
            Farmer.canal_id == canal.id,
            Schedule.date == slot_date,
            Schedule.status.in_(
                (ScheduleStatus.PENDING, ScheduleStatus.SCHEDULED, ScheduleStatus.IN_PROGRESS)
            ),
        )
        .order_by(Schedule.end_time.desc())
        .first()
    )
    return latest_end[0] if latest_end else DAY_START


def _sync_conflict(
    db: Session,
    canal: Canal,
    outcome: EngineOutcome,
    claims: list[Claim],
    requests: dict[int, WaterRequest],
    actor_id: str | None,
) -> None:
    conflict = open_conflict(db, canal.id)
    if not outcome.has_conflict:
        if conflict is not None:
            conflict.status = ConflictStatus.RESOLVED
            for req in requests.values():
                notify(
                    db,
                    req.farmer_id,
                    "Water conflict resolved",
                    f"Supply on canal {canal.name} now covers all open requests.",
                )
            audit(
                db,
                "conflict.resolved",
                "conflict",
                conflict.conflict_code,
                actor_id=actor_id,
                details={"canal_id": canal.id},
            )
        return

    farmer_ids = sorted({c.farmer_id for c in claims})
    if conflict is None:
        seq = db.query(Conflict).filter(Conflict.canal_id == canal.id).count() + 1
        conflict = Conflict(
            conflict_code=f"CNF-{canal.id}-{seq:04d}",
            canal_id=canal.id,
            status=ConflictStatus.DETECTED,
            total_demand=0,
            available_water=0,
            shortage=0,
        )
        db.add(conflict)
        db.flush()
    conflict.total_demand = outcome.total_demand
    conflict.available_water = outcome.available_water
    conflict.shortage = outcome.shortage
    conflict.proposal = _proposal_text(db, outcome.allocations, requests)
    if conflict.status == ConflictStatus.DETECTED:
        for fid in farmer_ids:
            notify(
                db,
                fid,
                f"Water shortage detected on canal {canal.name}",
                f"Demand {outcome.total_demand:.0f} exceeds available "
                f"{outcome.available_water:.0f} units (short {outcome.shortage:.0f}). "
                "A fair-share proposal has been generated.",
                NotificationSeverity.WARNING,
            )
    _sync_participants(db, conflict, farmer_ids)
    audit(
        db,
        "allocation.calculated",
        "conflict" if conflict.id else "canal",
        conflict.conflict_code,
        actor_id=actor_id,
        details={
            "canal_id": canal.id,
            "available": outcome.available_water,
            "demand": outcome.total_demand,
            "shortage": outcome.shortage,
        },
    )


def record_objection(
    db: Session,
    farmer: Farmer,
    user: AuthUser,
    reason: ObjectionReason,
    details: str | None,
    lang: str = "en",
) -> dict:
    """File an objection and recalculate with the farmer's priority boosted.

    The objection becomes a structured constraint (PS14 §16): urgency rises
    one level for the recalculation round, the engine reruns, and the farmer
    gets a revised — or evidence-backed unchanged — proposal. The mediation
    agent (LLM) then writes a negotiation reply grounded in that outcome —
    it explains the decision, it never computes one.
    """
    canal = db.get(Canal, farmer.canal_id) if farmer.canal_id else None
    if canal is None:
        raise ValueError("Farmer has no canal assigned")
    req = (
        db.query(WaterRequest)
        .filter(
            WaterRequest.farmer_id == farmer.id,
            WaterRequest.status.in_(OPEN_REQUEST_STATUSES),
        )
        .order_by(WaterRequest.id.desc())
        .first()
    )
    if req is None:
        raise ValueError("No open request to object against")
    allocation = (
        db.query(Allocation)
        .filter(
            Allocation.request_id == req.id,
            Allocation.status.in_(REWRITABLE_ALLOCATION_STATUSES),
        )
        .order_by(Allocation.id.desc())
        .first()
    )
    if allocation is None:
        raise ValueError("No open proposal to object against")
    previous_qty = float(allocation.allocated_quantity)

    conflict = open_conflict(db, canal.id)
    if conflict is None:
        # Objecting without a detected shortage still opens negotiation so
        # the concern is tracked rather than lost.
        seq = db.query(Conflict).filter(Conflict.canal_id == canal.id).count() + 1
        conflict = Conflict(
            conflict_code=f"CNF-{canal.id}-{seq:04d}",
            canal_id=canal.id,
            status=ConflictStatus.DETECTED,
            total_demand=float(req.quantity_requested),
            available_water=canal_available_water(canal),
            shortage=0,
        )
        db.add(conflict)
        db.flush()
    conflict.status = ConflictStatus.NEGOTIATION
    _sync_participants(db, conflict, [farmer.id])

    objection = Objection(
        conflict_id=conflict.id,
        farmer_id=farmer.id,
        reason=reason,
        details=details,
        status=ObjectionStatus.PENDING,
    )
    db.add(objection)

    boosted = _URGENCY_BOOST[req.urgency]
    if boosted != req.urgency:
        req.urgency = boosted
    db.flush()

    outcome = run_allocation_cycle(db, canal, actor_id=user.user_id)
    revised_qty = outcome.allocations.get(req.id, previous_qty)
    allocation.reason = build_reason(
        float(req.quantity_requested), revised_qty, outcome, revised=True
    )
    db.flush()

    changed = abs(revised_qty - previous_qty) > 0.005
    notify(
        db,
        farmer.id,
        "Objection recorded",
        f"Reason: {reason.value}. Urgency is now {req.urgency.value}; "
        + (
            f"revised proposal: {revised_qty:.0f} units."
            if changed
            else "proposal unchanged — supply and priority constraints leave no room; see evidence."
        ),
        NotificationSeverity.INFO,
    )

    mediator_message = mediate_objection(
        farmer_name=farmer.name,
        canal_name=canal.name,
        reason_label=_OBJECTION_REASON_LABEL.get(reason, reason.value),
        details=details,
        requested=float(req.quantity_requested),
        previous_allocated=previous_qty,
        revised_allocated=revised_qty,
        changed=changed,
        urgency=req.urgency.value,
        total_demand=outcome.total_demand,
        available_water=outcome.available_water,
        shortage=outcome.shortage,
        evidence=outcome.evidence,
        lang=lang,
    )
    objection.mediator_message = mediator_message
    db.flush()

    audit(
        db,
        "objection.recorded",
        "objection",
        str(objection.id),
        actor_type=ActorType.FARMER,
        actor_id=user.user_id,
        details={"reason": reason.value, "revised_qty": revised_qty},
    )
    return {
        "requested": float(req.quantity_requested),
        "previous_allocated": previous_qty,
        "allocated": revised_qty,
        "changed": changed,
        "reason": allocation.reason,
        "evidence": outcome.evidence,
        "conflict_code": conflict.conflict_code,
        "urgency": req.urgency.value,
        "mediator_message": mediator_message,
    }


def accept_proposal(db: Session, farmer: Farmer, user: AuthUser) -> Agreement:
    """Accept the current proposal: freeze a versioned agreement (PS14 §20)."""
    allocation = (
        db.query(Allocation)
        .join(WaterRequest, Allocation.request_id == WaterRequest.id)
        .filter(
            WaterRequest.farmer_id == farmer.id,
            Allocation.status.in_(REWRITABLE_ALLOCATION_STATUSES),
        )
        .order_by(Allocation.id.desc())
        .first()
    )
    if allocation is None:
        raise ValueError("No open proposal to accept")
    canal = db.get(Canal, farmer.canal_id) if farmer.canal_id else None

    allocation.status = AllocationStatus.ACCEPTED
    req = db.get(WaterRequest, allocation.request_id)
    if req is not None:
        req.status = RequestStatus.ACCEPTED

    others_pending = 0
    if canal is not None:
        conflict = open_conflict(db, canal.id)
        if conflict is not None:
            db.query(Objection).filter(
                Objection.conflict_id == conflict.id,
                Objection.farmer_id == farmer.id,
                Objection.status == ObjectionStatus.PENDING,
            ).update({Objection.status: ObjectionStatus.RESOLVED})
            others_pending = (
                db.query(Objection)
                .filter(
                    Objection.conflict_id == conflict.id,
                    Objection.status == ObjectionStatus.PENDING,
                )
                .count()
            )
            if others_pending == 0:
                conflict.status = ConflictStatus.RESOLVED

    # Snapshot every current allocation on the canal, not just this farmer's,
    # so the agreement is a complete record of what was accepted.
    snapshot: dict[str, float] = {}
    participant_ids: list[int] = []
    if canal is not None:
        rows = (
            db.query(Allocation)
            .join(Farmer, Allocation.farmer_id == Farmer.id)
            .filter(Farmer.canal_id == canal.id)
            .order_by(Allocation.id)
            .all()
        )
        latest: dict[int, Allocation] = {}
        for row in rows:
            latest[row.farmer_id] = row
        for fid, row in sorted(latest.items()):
            if row.status in (
                AllocationStatus.ACCEPTED,
                AllocationStatus.PROPOSED,
                AllocationStatus.SCHEDULED,
                AllocationStatus.IN_PROGRESS,
            ):
                snapshot[str(fid)] = float(row.allocated_quantity)
                participant_ids.append(fid)

    version = 1
    supersedes_id = None
    if canal is not None:
        prior = (
            db.query(Agreement)
            .filter(
                Agreement.canal_id == canal.id,
                Agreement.status == AgreementStatus.ACCEPTED,
            )
            .order_by(Agreement.version.desc())
            .first()
        )
        if prior is not None:
            version = prior.version + 1
            supersedes_id = prior.id
            prior.status = AgreementStatus.SUPERSEDED

    remaining_conflict = open_conflict(db, canal.id) if canal is not None else None
    agreement = Agreement(
        agreement_code=(
            f"AGR-{date.today():%Y%m%d}-{canal.id if canal else 0}-{version:02d}"
        ),
        conflict_id=remaining_conflict.id if remaining_conflict else None,
        canal_id=canal.id if canal else None,
        status=AgreementStatus.ACCEPTED,
        version=version,
        final_allocation=snapshot,
        participants=participant_ids,
        reason=allocation.reason,
        approved_by=user.user_id,
        supersedes_id=supersedes_id,
    )
    db.add(agreement)
    db.flush()

    notify(
        db,
        farmer.id,
        f"Agreement {agreement.agreement_code} accepted",
        f"{float(allocation.allocated_quantity):.0f} units confirmed. "
        "This record is versioned and cannot be silently changed.",
    )
    audit(
        db,
        "agreement.accepted",
        "agreement",
        agreement.agreement_code,
        actor_type=ActorType.FARMER,
        actor_id=user.user_id,
        details={"version": version, "allocation": snapshot},
    )
    return agreement
