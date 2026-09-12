"""Farmer dashboard summary: one call powers every dashboard section.

Definitions (also shown in the UI):
- available_water: the farmer's canal ``current_flow`` (capped by capacity).
- allocated_water: the latest active allocation quantity.
- remaining_water: allocated minus delivered on the latest allocation —
  the balance still left to receive.
"""

from fastapi import APIRouter, Depends, HTTPException, status as http_status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.auth import AuthUser, require_dam_operator, require_farmer
from app.db.session import get_db
from app.models.conflict import Conflict
from app.models.enums import (
    AllocationStatus,
    AnomalyStatus,
    ConflictStatus,
    RequestStatus,
    ScheduleStatus,
)
from app.models.farmer import Farmer
from app.models.monitoring import Anomaly
from app.models.network import Canal, Dam
from app.models.request import Allocation, Delivery, Schedule, WaterRequest
from app.models.system import Notification
from app.models.village import Village
from app.schemas.dashboard import (
    ActivityItem,
    CanalReleaseRow,
    DamDashboardSummary,
    FarmerDashboardSummary,
    FlowChainRead,
    FlowStageRead,
    RainfallRead,
    StatCard,
    WaterAdvisory,
)
from app.services.allocation import (
    EXPECTED_LOSS_FRACTION,
    UNACCOUNTED_ALERT_FRACTION,
    dam_status,
    flow_state,
    release_status,
)
from app.services.farmers import get_own_farmer
from app.services.mediation import (
    REWRITABLE_ALLOCATION_STATUSES,
    canal_available_water,
    open_conflict,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

_ACTIVE_ALLOCATION_STATUSES = REWRITABLE_ALLOCATION_STATUSES + (
    # Accepted/in-flight allocations still count as "current".
    AllocationStatus.ACCEPTED,
    AllocationStatus.SCHEDULED,
    AllocationStatus.IN_PROGRESS,
)


def _advisory(canal: Canal | None, has_allocation: bool, has_conflict: bool) -> WaterAdvisory:
    if canal is None:
        return WaterAdvisory(
            flow_state="unknown",
            has_conflict=False,
            lines=["No canal assigned yet — finish setup to see water status."],
        )
    state = flow_state(float(canal.current_flow), float(canal.capacity))
    lines = [
        f"Canal {canal.name} flow {float(canal.current_flow):.0f} "
        f"of {float(canal.capacity):.0f} capacity ({state})",
        (
            "Crop requirement checked against latest allocation"
            if has_allocation
            else "No allocation yet — submit a water request"
        ),
        (
            "Schedule adjusted for shortage — see Mediation"
            if has_conflict
            else "No change required to schedule"
        ),
    ]
    return WaterAdvisory(flow_state=state, has_conflict=has_conflict, lines=lines)


@router.get("/farmer", response_model=FarmerDashboardSummary)
def farmer_summary(
    user: AuthUser = Depends(require_farmer), db: Session = Depends(get_db)
) -> FarmerDashboardSummary:
    farmer = get_own_farmer(db, user)
    canal = db.get(Canal, farmer.canal_id) if farmer.canal_id else None
    village = db.get(Village, farmer.village_id)

    allocations = (
        db.query(Allocation)
        .filter(Allocation.farmer_id == farmer.id)
        .order_by(Allocation.id.desc())
        .limit(10)
        .all()
    )
    current = next(
        (a for a in allocations if a.status in _ACTIVE_ALLOCATION_STATUSES), None
    )
    current_request = db.get(WaterRequest, current.request_id) if current else None
    if current is None:
        current_request = (
            db.query(WaterRequest)
            .filter(WaterRequest.farmer_id == farmer.id)
            .order_by(WaterRequest.id.desc())
            .first()
        )

    delivery = None
    if current is not None:
        delivery = (
            db.query(Delivery)
            .filter(Delivery.allocation_id == current.id)
            .order_by(Delivery.id.desc())
            .first()
        )

    upcoming = (
        db.query(Schedule)
        .filter(
            Schedule.farmer_id == farmer.id,
            Schedule.status.in_(
                (ScheduleStatus.PENDING, ScheduleStatus.SCHEDULED, ScheduleStatus.IN_PROGRESS)
            ),
        )
        .order_by(Schedule.date, Schedule.start_time)
        .limit(10)
        .all()
    )
    requests = (
        db.query(WaterRequest)
        .filter(WaterRequest.farmer_id == farmer.id)
        .order_by(WaterRequest.id.desc())
        .limit(10)
        .all()
    )
    notifications = (
        db.query(Notification)
        .filter(Notification.farmer_id == farmer.id)
        .order_by(Notification.id.desc())
        .limit(10)
        .all()
    )

    available = canal_available_water(canal) if canal else 0.0
    allocated = float(current.allocated_quantity) if current else 0.0
    delivered = float(delivery.delivered_quantity) if delivery else 0.0
    remaining = max(0.0, allocated - delivered)
    has_conflict = canal is not None and open_conflict(db, canal.id) is not None

    recent_activity = [
        ActivityItem(
            title=n.title,
            meta=n.created_at.strftime("%d %b · %H:%M"),
            created_at=n.created_at,
        )
        for n in notifications[:5]
    ]

    return FarmerDashboardSummary(
        farmer_name=farmer.name,
        village_name=village.name if village else "",
        canal_name=canal.name if canal else None,
        available_water=available,
        allocated_water=allocated,
        remaining_water=remaining,
        has_request=current_request is not None,
        current_allocation=current,
        current_request=current_request,
        delivery=delivery,
        upcoming_schedules=upcoming,
        allocations=allocations,
        requests=requests,
        notifications=notifications,
        recent_activity=recent_activity,
        advisory=_advisory(canal, current is not None, has_conflict=has_conflict),
    )


_LIVE_REQUEST_STATUSES = (
    RequestStatus.PENDING,
    RequestStatus.PROCESSING,
    RequestStatus.PROPOSED,
    RequestStatus.ACCEPTED,
)


def _flow_chain(
    release: float, received: float, allocated: float, delivered: float
) -> FlowChainRead:
    """Water accounting across the six reservoir-panel stages.

    Expected loss is the documented prototype constant (8% of received,
    PS14 §6); unaccounted water includes balance still waiting to be
    allocated or delivered, which the stage notes say explicitly.
    """
    expected_loss = round(received * EXPECTED_LOSS_FRACTION, 2)
    unaccounted = round(received - delivered - expected_loss, 2)
    conveyance_gap = round(received - release, 2)
    unallocated = round(received - allocated, 2)
    pending = round(max(0.0, allocated - delivered), 2)
    alert = received > 0 and unaccounted > received * UNACCOUNTED_ALERT_FRACTION
    return FlowChainRead(
        stages=[
            FlowStageRead(
                label="Reservoir Release",
                value=release,
                note="Published outflow from the dam",
            ),
            FlowStageRead(
                label="Canal Received",
                value=received,
                note=(
                    f"{conveyance_gap:+,.0f} vs release"
                    + (" — conveyance gap under review" if conveyance_gap < 0 else "")
                ),
            ),
            FlowStageRead(
                label="Farmer Allocations",
                value=allocated,
                note=f"{unallocated:+,.0f} unallocated balance"
                + (" — over-committed" if unallocated < 0 else ""),
            ),
            FlowStageRead(
                label="Actual Delivery",
                value=delivered,
                note=f"{pending:,.0f} pending delivery",
            ),
            FlowStageRead(
                label="Expected Physical Loss",
                value=expected_loss,
                note="8% of received (prototype estimate)",
            ),
            FlowStageRead(label="Unaccounted Difference", value=unaccounted),
        ],
        unaccounted=unaccounted,
        alert=alert,
        alert_note=(
            "Large unexplained difference — flagging for canal-level investigation."
            if alert
            else None
        ),
    )


@router.get("/dam", response_model=DamDashboardSummary)
def dam_summary(
    user: AuthUser = Depends(require_dam_operator),
    db: Session = Depends(get_db),
) -> DamDashboardSummary:
    """Supply state for the dam operator's assigned dam: stats, releases, rain."""
    if user.dam_id is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="No dam assigned — set publicMetadata.dam_id in Clerk",
        )
    dam = db.get(Dam, user.dam_id)
    if dam is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND, detail="Dam not found"
        )
    canals = db.query(Canal).filter(Canal.dam_id == dam.id).order_by(Canal.name).all()
    canal_ids = [c.id for c in canals]

    # Batched per-canal aggregates (PS14 perf fix): the version of this loop
    # that issued 1-3 queries per canal took ~300ms per round trip against a
    # remote Postgres, so a dam with a dozen canals cost several seconds on
    # every dashboard/twin load. These three queries replace all of that,
    # regardless of how many canals the dam has.
    requested_by_canal: dict[int, float] = {}
    approved_by_canal: dict[int, float] = {}
    delivered_by_canal: dict[int, float] = {}
    if canal_ids:
        requested_by_canal = dict(
            db.query(Farmer.canal_id, func.sum(WaterRequest.quantity_requested))
            .join(WaterRequest, WaterRequest.farmer_id == Farmer.id)
            .filter(
                Farmer.canal_id.in_(canal_ids),
                WaterRequest.status.in_(_LIVE_REQUEST_STATUSES),
            )
            .group_by(Farmer.canal_id)
            .all()
        )
        # Latest allocation per farmer (so a superseded proposal doesn't
        # double-count) — one query for every canal's farmers, then dedupe
        # and re-group by canal in Python. A farmer belongs to exactly one
        # canal, so this is equivalent to doing the dedup per canal.
        approved_rows = (
            db.query(Allocation, Farmer.canal_id)
            .join(Farmer, Allocation.farmer_id == Farmer.id)
            .filter(
                Farmer.canal_id.in_(canal_ids),
                Allocation.status.in_(_ACTIVE_ALLOCATION_STATUSES),
            )
            .all()
        )
        latest_by_farmer: dict[int, Allocation] = {}
        canal_by_farmer: dict[int, int] = {}
        for allocation, canal_id in approved_rows:
            latest_by_farmer[allocation.farmer_id] = allocation
            canal_by_farmer[allocation.farmer_id] = canal_id
        for farmer_id, allocation in latest_by_farmer.items():
            c = canal_by_farmer[farmer_id]
            approved_by_canal[c] = approved_by_canal.get(c, 0.0) + float(allocation.allocated_quantity)

        delivered_by_canal = dict(
            db.query(Farmer.canal_id, func.sum(Delivery.delivered_quantity))
            .join(Allocation, Delivery.allocation_id == Allocation.id)
            .join(Farmer, Allocation.farmer_id == Farmer.id)
            .filter(Farmer.canal_id.in_(canal_ids))
            .group_by(Farmer.canal_id)
            .all()
        )

    releases: list[CanalReleaseRow] = []
    chain_received = 0.0
    chain_approved = 0.0
    chain_delivered = 0.0
    for canal in canals:
        requested_total = float(requested_by_canal.get(canal.id) or 0.0)
        approved_total = float(approved_by_canal.get(canal.id) or 0.0)
        received_total = float(delivered_by_canal.get(canal.id) or 0.0)
        released = float(canal.current_flow)
        difference = max(0.0, released - received_total)
        chain_received += released
        chain_approved += approved_total
        chain_delivered += received_total
        releases.append(
            CanalReleaseRow(
                canal=canal.name,
                requested=requested_total,
                approved=approved_total,
                released=released,
                received=received_total,
                difference=difference,
                status=release_status(released, difference, approved_total, received_total),
            )
        )

    open_anomalies = (
        db.query(Anomaly)
        .filter(
            Anomaly.canal_id.in_(canal_ids),
            Anomaly.status.in_(
                (AnomalyStatus.INVESTIGATION_REQUIRED, AnomalyStatus.INVESTIGATING)
            ),
        )
        .count()
        if canal_ids
        else 0
    )
    escalated = (
        db.query(Conflict)
        .filter(
            Conflict.canal_id.in_(canal_ids),
            Conflict.status == ConflictStatus.ESCALATED,
        )
        .count()
        if canal_ids
        else 0
    )
    emergencies = open_anomalies + escalated

    storage = float(dam.current_storage)
    available = float(dam.total_available)
    release_rate = sum(float(c.current_flow) for c in canals)
    status_label, status_tone = dam_status(storage, available)

    stats = [
        StatCard(label="Reservoir Level", value=f"{float(dam.water_level):.1f} m"),
        StatCard(label="Storage Volume", value=f"{storage:,.0f} units"),
        StatCard(label="Available Irrigation Water", value=f"{available:,.0f} units"),
        StatCard(label="Inflow", value=f"{float(dam.inflow):,.0f} units/day"),
        StatCard(label="Outflow", value=f"{float(dam.outflow):,.0f} units/day"),
        StatCard(label="Release Rate", value=f"{release_rate:,.0f} units/day"),
        StatCard(label="Rainfall", value=f"{float(dam.rainfall_last_24h):,.0f} mm"),
        StatCard(label="Dam Status", value=status_label, tone=status_tone),
        StatCard(
            label="Emergency Alerts",
            value=str(emergencies),
            tone="warn" if emergencies else None,
        ),
    ]
    first_canal = canals[0].name if canals else "—"
    flow_chain = _flow_chain(
        release=float(dam.outflow),
        received=chain_received,
        allocated=chain_approved,
        delivered=chain_delivered,
    )
    return DamDashboardSummary(
        dam_name=dam.name,
        stats=stats,
        releases=releases,
        rainfall=RainfallRead(
            last_24h=float(dam.rainfall_last_24h),
            forecast=dam.rainfall_forecast,
            catchment=f"Upper catchment, {first_canal} basin",
        ),
        flow_chain=flow_chain,
    )
