"""Farmer water requests: submit a requirement, list your history.

Submitting a request immediately runs the deterministic allocation cycle
for your canal, so the response already reflects your current proposal —
conflict detection, fair-share math, schedule, and notifications included.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import AuthUser, require_farmer
from app.db.session import get_db
from app.models.request import WaterRequest
from app.schemas.dashboard import WaterRequestSubmit
from app.schemas.request import WaterRequestRead
from app.services.farmers import get_own_farmer
from app.services.requests import NoCanalAssigned, submit_water_request

router = APIRouter(prefix="/requests", tags=["requests"])


@router.post("", response_model=WaterRequestRead, status_code=status.HTTP_201_CREATED)
def submit_request(
    payload: WaterRequestSubmit,
    user: AuthUser = Depends(require_farmer),
    db: Session = Depends(get_db),
) -> WaterRequest:
    """Submit a water requirement and get an allocation proposal back."""
    farmer = get_own_farmer(db, user)
    try:
        req = submit_water_request(
            db,
            farmer,
            quantity_requested=payload.quantity_requested,
            request_date=payload.request_date,
            preferred_time=payload.preferred_time,
            duration_hours=payload.duration_hours,
            crop=payload.crop,
            urgency=payload.urgency,
            actor_id=user.user_id,
        )
    except NoCanalAssigned as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
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
