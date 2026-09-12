"""Submit a farmer's water requirement and run the allocation cycle.

Extracted from the REST endpoint so the AI Coordinator (web chat + Twilio,
app/services/ai_coordinator.py) can submit a request through the exact same
code path — no separate business logic per channel.
"""

from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

from app.models.enums import AllocationStatus, PriorityLevel, RequestStatus, ScheduleStatus
from app.models.farmer import Farmer, Field
from app.models.network import Canal
from app.models.request import Allocation, Schedule, WaterRequest
from app.services.crop_norms import TOLERANCE, max_allowed, norm_per_acre
from app.services.mediation import (
    OPEN_REQUEST_STATUSES,
    REWRITABLE_ALLOCATION_STATUSES,
    notify,
    run_allocation_cycle,
)


class NoCanalAssigned(ValueError):
    """The farmer hasn't completed onboarding with a canal yet."""


class RequestDateInPast(ValueError):
    """A past request_date must never reach the allocation/schedule engine —
    enforced here (not just the REST endpoint) so every channel that can
    submit a request (website, AI Coordinator chat, Twilio) is covered."""


class NoOpenRequest(ValueError):
    """No open (not yet accepted) request exists to cancel."""


class RequestExceedsLimit(ValueError):
    """Requested quantity is above the area × norm × tolerance cap."""

    def __init__(self, message: str, *, max_allowed: float):
        super().__init__(message)
        self.max_allowed = max_allowed


def farmer_limit(db: Session, farmer: Farmer, crop: str | None = None) -> dict:
    """Max requestable units for this farmer: total field area × norm × tolerance.

    Norm is looked up by the *requested* crop (or the farmer's own crop when
    none is given yet) and the primary field's stage. Farmers with no field
    row yet get no cap (empty area) so onboarding is never blocked.
    """
    fields = db.query(Field).filter(Field.farmer_id == farmer.id).all()
    total_area = sum(float(f.area_acres) for f in fields)
    primary = next((f for f in fields if f.id == farmer.field_id), None) or (
        fields[0] if fields else None
    )
    stage = primary.crop_stage if primary else None
    use_crop = crop or (primary.crop if primary else None) or "default"
    norm = norm_per_acre(use_crop, stage)
    cap = max_allowed(total_area, use_crop, stage)
    return {
        "max_allowed": cap,
        "total_area_acres": round(total_area, 2),
        "crop": use_crop,
        "crop_stage": stage,
        "norm_per_acre": round(norm, 2),
        "tolerance": TOLERANCE,
        "has_fields": primary is not None,
    }


def _cancel_open_request(db: Session, req: WaterRequest) -> None:
    """Mark one request (and its live allocation/schedule) cancelled — used
    both by explicit cancel_water_request and by submit_water_request's
    auto-supersede, so a farmer is never left with two open requests
    silently competing for the same canal (loopholes doc §2.3/§2.5/§10.2:
    a farmer's changed or withdrawn requirement must become a *replacement*
    constraint, not a second, invisible claim)."""
    req.status = RequestStatus.CANCELLED
    allocation = (
        db.query(Allocation)
        .filter(Allocation.request_id == req.id, Allocation.status.in_(REWRITABLE_ALLOCATION_STATUSES))
        .order_by(Allocation.id.desc())
        .first()
    )
    if allocation is not None:
        allocation.status = AllocationStatus.CANCELLED
        db.query(Schedule).filter(
            Schedule.allocation_id == allocation.id,
            Schedule.status.in_((ScheduleStatus.PENDING, ScheduleStatus.SCHEDULED)),
        ).update({Schedule.status: ScheduleStatus.CANCELLED}, synchronize_session=False)


def submit_water_request(
    db: Session,
    farmer: Farmer,
    *,
    quantity_requested: float,
    request_date: date,
    preferred_time: str,
    duration_hours: float,
    crop: str,
    urgency: PriorityLevel = PriorityLevel.NORMAL,
    actor_id: str | None = None,
) -> WaterRequest:
    if request_date < date.today():
        raise RequestDateInPast("Request date cannot be in the past.")
    limit = farmer_limit(db, farmer, crop)
    if limit["has_fields"] and quantity_requested - limit["max_allowed"] > 0.01:
        raise RequestExceedsLimit(
            f"Requested {quantity_requested:.0f} exceeds your max {limit['max_allowed']:.0f} "
            f"units ({limit['total_area_acres']:.2f} acres × {limit['norm_per_acre']:.0f}/acre "
            f"× {limit['tolerance']} tolerance).",
            max_allowed=limit["max_allowed"],
        )
    canal = db.get(Canal, farmer.canal_id) if farmer.canal_id else None
    if canal is None:
        raise NoCanalAssigned("No canal assigned — complete onboarding with a canal first")

    # A farmer can only ever have one *open* requirement at a time — a new
    # submission replaces it rather than sitting alongside it as a second,
    # invisible competing claim (the exact bug a duplicate/rushed submit
    # used to cause: the older request kept consuming canal capacity with
    # no way for the farmer to see or act on it).
    still_open = (
        db.query(WaterRequest)
        .filter(WaterRequest.farmer_id == farmer.id, WaterRequest.status.in_(OPEN_REQUEST_STATUSES))
        .all()
    )
    for old in still_open:
        _cancel_open_request(db, old)
    if still_open:
        db.flush()

    req = WaterRequest(
        farmer_id=farmer.id,
        quantity_requested=quantity_requested,
        request_date=request_date,
        preferred_time=preferred_time,
        duration_hours=duration_hours,
        crop=crop,
        urgency=urgency,
    )
    db.add(req)
    db.flush()
    notify(
        db,
        farmer.id,
        f"Request submitted: {quantity_requested:.0f} units for {request_date.isoformat()}",
        f"Crop {crop}, preferred slot {preferred_time}."
        + (" This replaces your previous open request." if still_open else ""),
    )
    run_allocation_cycle(db, canal, actor_id=actor_id or farmer.clerk_user_id)
    db.flush()
    return req


def cancel_water_request(
    db: Session, farmer: Farmer, actor_id: str | None = None
) -> WaterRequest:
    """Withdraw the farmer's current open request (PS14 loopholes §2.5,
    §10.2): release its claim on the canal immediately so the allocation
    cycle re-runs for every other open farmer on the same canal, instead of
    leaving the water earmarked for a request nobody wants anymore."""
    req = (
        db.query(WaterRequest)
        .filter(WaterRequest.farmer_id == farmer.id, WaterRequest.status.in_(OPEN_REQUEST_STATUSES))
        .order_by(WaterRequest.id.desc())
        .first()
    )
    if req is None:
        raise NoOpenRequest("No open request to cancel")
    canal = db.get(Canal, farmer.canal_id) if farmer.canal_id else None
    _cancel_open_request(db, req)
    db.flush()
    if canal is not None:
        run_allocation_cycle(db, canal, actor_id=actor_id or farmer.clerk_user_id)
    notify(
        db,
        farmer.id,
        "Request cancelled",
        f"Your request for {float(req.quantity_requested):.0f} units has been withdrawn.",
    )
    db.flush()
    return req
