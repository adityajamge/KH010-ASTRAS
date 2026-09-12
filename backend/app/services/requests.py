"""Submit a farmer's water requirement and run the allocation cycle.

Extracted from the REST endpoint so the AI Coordinator (web chat + Twilio,
app/services/ai_coordinator.py) can submit a request through the exact same
code path — no separate business logic per channel.
"""

from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

from app.models.enums import PriorityLevel
from app.models.farmer import Farmer
from app.models.network import Canal
from app.models.request import WaterRequest
from app.services.mediation import notify, run_allocation_cycle


class NoCanalAssigned(ValueError):
    """The farmer hasn't completed onboarding with a canal yet."""


class RequestDateInPast(ValueError):
    """A past request_date must never reach the allocation/schedule engine —
    enforced here (not just the REST endpoint) so every channel that can
    submit a request (website, AI Coordinator chat, Twilio) is covered."""


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
    canal = db.get(Canal, farmer.canal_id) if farmer.canal_id else None
    if canal is None:
        raise NoCanalAssigned("No canal assigned — complete onboarding with a canal first")
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
        f"Crop {crop}, preferred slot {preferred_time}.",
    )
    run_allocation_cycle(db, canal, actor_id=actor_id or farmer.clerk_user_id)
    db.flush()
    return req
