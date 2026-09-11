"""Farmer water requests: submit a requirement, list your history.

Submitting a request immediately runs the deterministic allocation cycle
for your canal, so the response already reflects your current proposal —
conflict detection, fair-share math, schedule, and notifications included.
"""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import AuthUser, require_farmer
from app.db.session import get_db
from app.models.network import Canal
from app.models.request import WaterRequest
from app.schemas.dashboard import WaterRequestSubmit
from app.schemas.request import WaterRequestRead
from app.services.farmers import get_own_farmer
from app.services.mediation import notify, run_allocation_cycle

router = APIRouter(prefix="/requests", tags=["requests"])


@router.post("", response_model=WaterRequestRead, status_code=status.HTTP_201_CREATED)
def submit_request(
    payload: WaterRequestSubmit,
    user: AuthUser = Depends(require_farmer),
    db: Session = Depends(get_db),
) -> WaterRequest:
    """Submit a water requirement and get an allocation proposal back."""
    if payload.request_date < date.today():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request date cannot be in the past.",
        )
    farmer = get_own_farmer(db, user)
    canal = db.get(Canal, farmer.canal_id) if farmer.canal_id else None
    if canal is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No canal assigned — complete onboarding with a canal first",
        )
    req = WaterRequest(
        farmer_id=farmer.id,
        quantity_requested=payload.quantity_requested,
        request_date=payload.request_date,
        preferred_time=payload.preferred_time,
        duration_hours=payload.duration_hours,
        crop=payload.crop,
        urgency=payload.urgency,
    )
    db.add(req)
    db.flush()
    notify(
        db,
        farmer.id,
        f"Request submitted: {payload.quantity_requested:.0f} units for "
        f"{payload.request_date.isoformat()}",
        f"Crop {payload.crop}, preferred slot {payload.preferred_time}.",
    )
    run_allocation_cycle(db, canal, actor_id=user.user_id)
    db.commit()
    db.refresh(req)
    return req


@router.get("/me", response_model=list[WaterRequestRead])
def list_own_requests(
    user: AuthUser = Depends(require_farmer), db: Session = Depends(get_db)
) -> list[WaterRequest]:
    """The signed-in farmer's requests, newest first."""
    farmer = get_own_farmer(db, user)
    return (
        db.query(WaterRequest)
        .filter(WaterRequest.farmer_id == farmer.id)
        .order_by(WaterRequest.id.desc())
        .limit(20)
        .all()
    )
