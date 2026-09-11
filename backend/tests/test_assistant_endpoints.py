"""HTTP wiring for the two AI Coordinator entry points: the website chat
(/api/v1/assistant/*) and the Twilio webhook (/api/v1/twilio/inbound). The
agent loop itself is covered by test_ai_coordinator.py — these tests only
check that both surfaces reach app.services.ai_coordinator.handle_message
with the right identity resolved, and shape their response correctly
(JSON vs. TwiML).
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api.v1.endpoints import twilio_webhook
from app.core.auth import AuthUser, require_any_role
from app.core.config import settings
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.enums import ChannelType
from app.models.farmer import Farmer
from app.models.village import Village
from app.services import ai_coordinator

CLERK_ID = "clerk-farmer-1"


@pytest.fixture()
def db_session(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path}/test.db")
    Base.metadata.create_all(bind=engine)
    factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = factory()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture()
def farmer(db_session):
    db_session.add(Village(id=1, name="Rampur"))
    row = Farmer(clerk_user_id=CLERK_ID, name="Farmer A", village_id=1, phone="+91 90000 00001")
    db_session.add(row)
    db_session.commit()
    return row


@pytest.fixture()
def client(db_session):
    def override_db():
        try:
            yield db_session
        finally:
            pass

    def override_user():
        return AuthUser(user_id=CLERK_ID, role="farmer")

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[require_any_role] = override_user
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_post_message_returns_the_coordinator_reply(client, farmer, monkeypatch):
    monkeypatch.setattr(ai_coordinator, "handle_message", lambda *a, **k: "hello farmer")
    response = client.post("/api/v1/assistant/message", json={"text": "hi"})
    assert response.status_code == 200
    assert response.json() == {"reply": "hello farmer"}


def test_history_returns_persisted_turns(client, farmer, monkeypatch, db_session):
    def fake_handle_message(db, **kwargs):
        ai_coordinator._log(db, "farmer", CLERK_ID, ChannelType.WEB, ai_coordinator.MessageRole.ASSISTANT, "hi back")
        return "hi back"

    monkeypatch.setattr(ai_coordinator, "handle_message", fake_handle_message)
    client.post("/api/v1/assistant/message", json={"text": "hello"})

    response = client.get("/api/v1/assistant/history")
    assert response.status_code == 200
    roles = [row["role"] for row in response.json()]
    assert "assistant" in roles


def test_twilio_inbound_routes_to_the_matching_farmer(db_session, farmer, monkeypatch):
    monkeypatch.setattr(settings, "TWILIO_ACCOUNT_SID", "test-sid")
    monkeypatch.setattr(settings, "TWILIO_AUTH_TOKEN", "test-token")
    monkeypatch.setattr(settings, "TWILIO_VALIDATE_SIGNATURE", False)

    seen: dict = {}

    def fake_handle_message(db, **kwargs):
        seen.update(kwargs)
        return "your allocation is fine"

    monkeypatch.setattr(ai_coordinator, "handle_message", fake_handle_message)

    def override_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_db
    try:
        with TestClient(app, raise_server_exceptions=False) as test_client:
            response = test_client.post(
                "/api/v1/twilio/inbound",
                data={"From": "whatsapp:+919000000001", "Body": "why is my water low?"},
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert "your allocation is fine" in response.text
    assert seen["farmer"].id == farmer.id
    assert seen["channel"] == ChannelType.TWILIO


def test_twilio_inbound_unregistered_number_gets_onboarding_prompt(db_session, monkeypatch):
    monkeypatch.setattr(settings, "TWILIO_ACCOUNT_SID", "test-sid")
    monkeypatch.setattr(settings, "TWILIO_AUTH_TOKEN", "test-token")
    monkeypatch.setattr(settings, "TWILIO_VALIDATE_SIGNATURE", False)

    def override_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_db
    try:
        with TestClient(app, raise_server_exceptions=False) as test_client:
            response = test_client.post(
                "/api/v1/twilio/inbound",
                data={"From": "whatsapp:+919999999999", "Body": "hello"},
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert twilio_webhook._NOT_REGISTERED_REPLY in response.text
