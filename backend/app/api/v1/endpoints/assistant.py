"""Website chat channel for the AI Coordinator.

Twilio (app/api/v1/endpoints/twilio_webhook.py) calls the exact same
app.services.ai_coordinator.handle_message — this file only adapts the
authenticated HTTP request/response shape for the website widget.
"""

import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import AuthUser, require_any_role
from app.db.session import get_db
from app.models.assistant import AssistantMessage
from app.models.enums import ChannelType
from app.schemas.assistant import AssistantHistoryItem, AssistantMessageIn, AssistantMessageOut
from app.services import ai_coordinator
from app.services.farmers import get_own_farmer

router = APIRouter(prefix="/assistant", tags=["assistant"])
logger = logging.getLogger(__name__)


@router.post("/message", response_model=AssistantMessageOut)
def post_message(
    payload: AssistantMessageIn,
    user: AuthUser = Depends(require_any_role),
    db: Session = Depends(get_db),
) -> AssistantMessageOut:
    farmer = None
    if user.role == "farmer":
        farmer = get_own_farmer(db, user)
    reply = ai_coordinator.handle_message(
        db,
        role=user.role or "farmer",
        actor_id=user.user_id,
        channel=ChannelType.WEB,
        text=payload.text,
        farmer=farmer,
        dam_id=user.dam_id,
        lang=payload.lang,
    )
    try:
        db.commit()
    except Exception:  # noqa: BLE001 — a DB hiccup must not surface as a raw 500 to the chat
        db.rollback()
        logger.exception("Failed to persist assistant turn for %s", user.user_id)
        return AssistantMessageOut(reply=ai_coordinator.UNAVAILABLE_REPLY)
    return AssistantMessageOut(reply=reply)


@router.get("/history", response_model=list[AssistantHistoryItem])
def get_history(
    user: AuthUser = Depends(require_any_role),
    db: Session = Depends(get_db),
    limit: int = 30,
) -> list[AssistantMessage]:
    """The signed-in user's website chat history, oldest first."""
    rows = (
        db.query(AssistantMessage)
        .filter(
            AssistantMessage.actor_id == user.user_id,
            AssistantMessage.channel == ChannelType.WEB,
        )
        .order_by(AssistantMessage.id.desc())
        .limit(min(limit, 100))
        .all()
    )
    rows.reverse()
    return rows
