"""Farmer profile + onboarding.

A Clerk account with role=farmer has no JalSetu data until it completes the
onboarding form (name, village, phone, canal, primary field). GET /farmers/me
404s until that happens; the frontend uses that to gate the dashboard behind
an onboarding screen.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import AuthUser, require_farmer
from app.db.session import get_db
from app.models.farmer import Farmer, Field
from app.schemas.farmer import FarmerOnboardingRequest, FarmerProfileRead

router = APIRouter(prefix="/farmers", tags=["farmers"])

# Single-village prototype: every farmer is auto-assigned here, no picker in the UI.
DEFAULT_VILLAGE_ID = 1


def _get_own_farmer(db: Session, user: AuthUser) -> Farmer | None:
    return db.query(Farmer).filter(Farmer.clerk_user_id == user.user_id).first()


@router.get("/me", response_model=FarmerProfileRead)
def read_own_farmer(
    user: AuthUser = Depends(require_farmer), db: Session = Depends(get_db)
) -> Farmer:
    """The signed-in farmer's profile. 404 means onboarding has not run yet."""
    farmer = _get_own_farmer(db, user)
    if farmer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Farmer profile not found"
        )
    return farmer


@router.post(
    "/onboard", response_model=FarmerProfileRead, status_code=status.HTTP_201_CREATED
)
def onboard_farmer(
    payload: FarmerOnboardingRequest,
    user: AuthUser = Depends(require_farmer),
    db: Session = Depends(get_db),
) -> Farmer:
    """Create the farmer profile + primary field. One-time; 409 if already done."""
    if _get_own_farmer(db, user) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Farmer profile already exists",
        )

    farmer = Farmer(
        clerk_user_id=user.user_id,
        name=payload.name,
        village_id=DEFAULT_VILLAGE_ID,
        phone=payload.phone,
        canal_id=payload.canal_id,
    )
    db.add(farmer)
    db.flush()  # assign farmer.id for the field's FK

    field = Field(
        farmer_id=farmer.id,
        area_acres=payload.field.area_acres,
        crop=payload.field.crop,
        crop_stage=payload.field.crop_stage,
        priority=payload.field.priority,
    )
    db.add(field)
    db.flush()  # assign field.id

    farmer.field_id = field.id
    db.commit()
    db.refresh(farmer)
    return farmer
