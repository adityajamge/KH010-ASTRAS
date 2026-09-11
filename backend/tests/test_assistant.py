"""Assistant chat endpoint: only the config-gate is tested here (no network
call to Anthropic) — mirrors the CLERK_SECRET_KEY 503 pattern in test_auth.py.
"""

from fastapi.testclient import TestClient

from app.core.auth import AuthUser, require_any_role
from app.core.config import settings
from app.main import app


def test_chat_returns_503_when_anthropic_key_missing(monkeypatch):
    # Force the unconfigured state regardless of the real .env — this
    # environment may have a real ANTHROPIC_API_KEY set (and it should).
    monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", "")
    app.dependency_overrides[require_any_role] = lambda: AuthUser(
        user_id="clerk-test", role="farmer"
    )
    try:
        with TestClient(app, raise_server_exceptions=False) as client:
            response = client.post("/api/v1/assistant/chat", json={"message": "hi"})
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 503, response.text
    assert "ANTHROPIC_API_KEY" in response.json()["detail"]
