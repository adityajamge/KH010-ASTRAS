"""Twilio transport for the JalSetu AI Coordinator.

Twilio is a communication channel only — every message it carries is handed
to app.services.ai_coordinator.handle_message, the exact function the
website chat calls. Nothing in this module decides allocations, evidence, or
wording; it only moves text in and out over WhatsApp/SMS.
"""

from __future__ import annotations

import logging

from fastapi import Request

from app.core.config import settings

logger = logging.getLogger(__name__)


def is_configured() -> bool:
    return bool(settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN)


def get_twilio_client():
    if not is_configured():
        return None
    from twilio.rest import Client

    return Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)


async def validate_signature(request: Request, form: dict) -> bool:
    """Verify the ``X-Twilio-Signature`` header against the request.

    Skipped (returns True) when signature validation is turned off — local
    dev has no public HTTPS URL for Twilio to sign against.
    """
    if not settings.TWILIO_VALIDATE_SIGNATURE or not is_configured():
        return True
    from twilio.request_validator import RequestValidator

    signature = request.headers.get("X-Twilio-Signature", "")
    validator = RequestValidator(settings.TWILIO_AUTH_TOKEN)
    return validator.validate(str(request.url), form, signature)


def send_whatsapp(to_phone: str, body: str) -> None:
    """Best-effort outbound send (e.g. a proactive notification). Swallows
    every failure — a missing Twilio configuration or a bad number must
    never break the deterministic workflow that triggered the notification.
    """
    client = get_twilio_client()
    if client is None or not settings.TWILIO_WHATSAPP_FROM:
        return
    try:
        client.messages.create(
            from_=settings.TWILIO_WHATSAPP_FROM,
            to=f"whatsapp:{to_phone}" if not to_phone.startswith("whatsapp:") else to_phone,
            body=body[:1500],
        )
    except Exception:  # noqa: BLE001 — notification delivery must never raise
        logger.warning("Twilio send failed for %s", to_phone, exc_info=True)
