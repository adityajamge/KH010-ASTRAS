"""Farmer-profile lookup shared by farmer-scoped endpoints."""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import AuthUser
from app.models.farmer import Farmer


def get_own_farmer(db: Session, user: AuthUser) -> Farmer:
    """The signed-in farmer's profile. 404 when onboarding hasn't run yet."""
    farmer = (
        db.query(Farmer).filter(Farmer.clerk_user_id == user.user_id).first()
    )
    if farmer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farmer profile not found — complete onboarding first",
        )
    return farmer
