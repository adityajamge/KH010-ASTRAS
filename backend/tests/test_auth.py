from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app, raise_server_exceptions=False)


def test_me_without_token_is_unauthorized_or_unconfigured() -> None:
    """No token -> 401 (or 503 when CLERK_SECRET_KEY is not configured)."""
    response = client.get("/api/v1/me")
    assert response.status_code in (401, 503)


def test_me_with_bad_token_is_rejected() -> None:
    response = client.get(
        "/api/v1/me", headers={"Authorization": "Bearer not-a-real-token"}
    )
    assert response.status_code in (401, 503)
