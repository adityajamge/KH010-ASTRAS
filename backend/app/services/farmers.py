"""Farmer-profile lookup shared by farmer-scoped endpoints."""

import re

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


def normalize_phone(raw: str) -> str:
    """Digits only, last 10 — enough to match local numbers regardless of
    how a country code or "whatsapp:"/"sms:" prefix was written on either
    side (Twilio's ``From`` vs. the number a farmer typed at onboarding)."""
    digits = re.sub(r"\D", "", raw)
    return digits[-10:] if len(digits) >= 10 else digits


def find_farmer_by_phone(db: Session, raw_phone: str) -> Farmer | None:
    """Match an inbound Twilio number to a farmer profile (PS14 "AI Chat +
    Twilio": the same backend/identity, just a different channel)."""
    target = normalize_phone(raw_phone)
    if not target:
        return None
    for farmer in db.query(Farmer).all():
        if normalize_phone(farmer.phone) == target:
            return farmer
    return None
