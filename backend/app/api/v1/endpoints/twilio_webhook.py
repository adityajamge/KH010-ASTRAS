"""Twilio channel for the AI Coordinator (WhatsApp/SMS prototype).

Same backend, same agent workflow, same allocation logic as the website
chat (app/api/v1/endpoints/assistant.py) — this file only adapts Twilio's
webhook shape (form-encoded request, TwiML response) and resolves the
inbound phone number to a farmer profile, since Twilio carries no Clerk
session. Register this URL as the WhatsApp/SMS webhook in the Twilio
console: POST {API_URL}/api/v1/twilio/inbound.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.enums import ChannelType
from app.services import ai_coordinator, twilio_client
from app.services.farmers import find_farmer_by_phone

router = APIRouter(prefix="/twilio", tags=["twilio"])
logger = logging.getLogger(__name__)

_NOT_REGISTERED_REPLY = (
    "We couldn't find a JalSetu account for this number. Please complete "
    "onboarding on the JalSetu website with this phone number, then message "
    "us again."
)
_EMPTY_BODY_REPLY = (
    "Please send a message describing what you need — e.g. 'I need 5000 "
    "units of water tomorrow morning' or 'why was my water reduced?'."
)


def _twiml(message: str) -> Response:
    from twilio.twiml.messaging_response import MessagingResponse

    resp = MessagingResponse()
    resp.message(message[:1500])
    return Response(content=str(resp), media_type="application/xml")


@router.post("/inbound")
async def inbound_message(request: Request, db: Session = Depends(get_db)) -> Response:
    if not twilio_client.is_configured():
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Twilio not configured: set TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN",
        )

    form = await request.form()
    form_dict = {key: str(value) for key, value in form.items()}

    if not await twilio_client.validate_signature(request, form_dict):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Invalid Twilio signature")

    from_raw = form_dict.get("From", "")
    body = form_dict.get("Body", "").strip()

    farmer = find_farmer_by_phone(db, from_raw)
    if farmer is None:
        return _twiml(_NOT_REGISTERED_REPLY)
    if not body:
        return _twiml(_EMPTY_BODY_REPLY)

    try:
        reply = ai_coordinator.handle_message(
            db,
            role="farmer",
            actor_id=farmer.clerk_user_id,
            channel=ChannelType.TWILIO,
            text=body,
            farmer=farmer,
        )
        db.commit()
    except Exception:  # noqa: BLE001 — Twilio needs valid TwiML back regardless
        db.rollback()
        logger.exception("Twilio inbound handling failed for farmer %s", farmer.id)
        reply = ai_coordinator.UNAVAILABLE_REPLY
    return _twiml(reply)
