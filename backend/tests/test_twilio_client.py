"""Twilio signature validation must survive being fronted by ngrok (or any
reverse proxy) in local dev.

Bug this guards against: ngrok terminates TLS and forwards plain HTTP to
uvicorn on localhost. Without trusting X-Forwarded-*, uvicorn reports the
scheme as "http", so ``request.url`` never matches the "https://..." URL
Twilio actually signed — every real webhook call would fail validation
(403) even with a fully correct TWILIO_AUTH_TOKEN and a live tunnel. See
app/services/twilio_client.py::_public_url.
"""

import asyncio

import pytest
from starlette.requests import Request
from twilio.request_validator import RequestValidator

from app.core.config import settings
from app.services import twilio_client

PUBLIC_URL = "https://abcd1234.ngrok-free.app/api/v1/twilio/inbound"
FORM = {"From": "whatsapp:+919000000000", "Body": "hi"}


def _make_request(headers: dict) -> Request:
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/v1/twilio/inbound",
        "raw_path": b"/api/v1/twilio/inbound",
        "query_string": b"",
        "headers": [(k.lower().encode(), v.encode()) for k, v in headers.items()],
        "scheme": "http",  # what uvicorn actually sees, behind the tunnel
        "server": ("localhost", 8000),
        "client": ("127.0.0.1", 12345),
    }
    return Request(scope)


def test_public_url_prefers_forwarded_headers_over_the_local_scheme():
    request = _make_request({"x-forwarded-proto": "https", "x-forwarded-host": "abcd1234.ngrok-free.app"})
    assert twilio_client._public_url(request) == PUBLIC_URL


def test_public_url_falls_back_to_request_url_without_a_proxy():
    request = _make_request({"host": "localhost:8000"})
    assert twilio_client._public_url(request) == "http://localhost:8000/api/v1/twilio/inbound"


@pytest.fixture()
def twilio_configured(monkeypatch):
    monkeypatch.setattr(settings, "TWILIO_ACCOUNT_SID", "ACtest")
    monkeypatch.setattr(settings, "TWILIO_AUTH_TOKEN", "test-auth-token")
    monkeypatch.setattr(settings, "TWILIO_VALIDATE_SIGNATURE", True)


def test_validate_signature_passes_behind_ngrok_with_forwarded_headers(twilio_configured):
    signature = RequestValidator("test-auth-token").compute_signature(PUBLIC_URL, FORM)
    request = _make_request(
        {
            "x-forwarded-proto": "https",
            "x-forwarded-host": "abcd1234.ngrok-free.app",
            "x-twilio-signature": signature,
        }
    )
    assert asyncio.run(twilio_client.validate_signature(request, FORM)) is True


def test_validate_signature_rejects_a_forged_signature(twilio_configured):
    request = _make_request(
        {
            "x-forwarded-proto": "https",
            "x-forwarded-host": "abcd1234.ngrok-free.app",
            "x-twilio-signature": "not-a-real-signature",
        }
    )
    assert asyncio.run(twilio_client.validate_signature(request, FORM)) is False


def test_validate_signature_fails_safely_without_proxy_headers(twilio_configured):
    """No X-Forwarded-* headers (e.g. calling the endpoint directly, not
    through the tunnel): falls back to the local http:// URL, which
    correctly does NOT match a signature computed for the https:// one —
    trusting forwarded headers never widens what validates."""
    signature = RequestValidator("test-auth-token").compute_signature(PUBLIC_URL, FORM)
    request = _make_request({"host": "abcd1234.ngrok-free.app", "x-twilio-signature": signature})
    assert asyncio.run(twilio_client.validate_signature(request, FORM)) is False


def test_validate_signature_skipped_when_disabled(monkeypatch):
    monkeypatch.setattr(settings, "TWILIO_VALIDATE_SIGNATURE", False)
    request = _make_request({})
    assert asyncio.run(twilio_client.validate_signature(request, FORM)) is True
