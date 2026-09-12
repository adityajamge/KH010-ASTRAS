"""More decision-logic branches that had no coverage: the dam/release
status-threshold functions (only their "everything is fine" branch was ever
exercised), a second accept cycle actually incrementing the agreement
version and superseding the first, and the Jal Vigyani conflict-decision
endpoint's request_revision/escalate actions (only approve was covered)."""

from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.auth import AuthUser, require_farmer, require_jal_vigyani, require_jal_vigyani_dam_id
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.conflict import Agreement
from app.models.enums import AgreementStatus, PriorityLevel
from app.models.farmer import Farmer, Field
from app.models.network import Canal, Dam
from app.models.village import Village
from app.services.allocation import dam_status, release_status

TEST_CLERK_ID = "clerk-farmer-1"
_current = {"key": "f1"}


# ---------- dam_status / release_status: every branch ----------


def test_dam_status_thresholds():
    assert dam_status(1000, 0) == ("Unknown", None)
    assert dam_status(1200, 1000) == ("Normal", "ok")  # ratio >= 1
    assert dam_status(600, 1000) == ("Watch", "warn")  # 0.5 <= ratio < 1
    assert dam_status(400, 1000) == ("Critical", "danger")  # ratio < 0.5


def test_release_status_thresholds():
    assert release_status(released=0, difference=0, approved=0, received=0) == "Normal"
    assert release_status(released=1000, difference=0, approved=0, received=0) == "Normal"
    # 8% difference -> Minor Difference band (0.05 <= ratio < 0.15)
    assert (
        release_status(released=1000, difference=80, approved=500, received=920)
        == "Minor Difference"
    )
    # 20% difference -> Needs Investigation
    assert (
        release_status(released=1000, difference=200, approved=500, received=800)
        == "Needs Investigation"
    )


# ---------- Agreement versioning across a second accept cycle ----------


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
def seed(db_session):
    db_session.add(Village(id=1, name="Rampur"))
    db_session.add(
        Dam(id=1, name="Rampur Dam", village_id=1, total_available=4200,
            current_storage=5000, inflow=850, outflow=700)
    )
    db_session.add(Canal(id=1, dam_id=1, name="C1", capacity=1200, current_flow=1000, water_level=2.4))
    farmer = Farmer(
        clerk_user_id=TEST_CLERK_ID, name="Farmer A", village_id=1,
        phone="+91 90000 00000", canal_id=1,
    )
    db_session.add(farmer)
    db_session.flush()
    db_session.add(
        Field(farmer_id=farmer.id, area_acres=2.5, crop="Sugarcane",
              crop_stage="Tillering", priority=PriorityLevel.NORMAL)
    )
    db_session.commit()
    return farmer


@pytest.fixture()
def client(db_session):
    def override_db():
        try:
            yield db_session
        finally:
            pass

    def override_user():
        return AuthUser(user_id=TEST_CLERK_ID, role="farmer")

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[require_farmer] = override_user
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_second_accept_cycle_increments_version_and_supersedes(client, seed, db_session):
    client.post(
        "/api/v1/requests",
        json={
            "quantity_requested": 300, "request_date": date.today().isoformat(),
            "preferred_time": "morning", "duration_hours": 2,
            "crop": "Sugarcane", "urgency": "normal",
        },
    )
    first = client.post("/api/v1/mediation/accept").json()
    assert first["agreement"]["version"] == 1

    client.post(
        "/api/v1/requests",
        json={
            "quantity_requested": 200, "request_date": date.today().isoformat(),
            "preferred_time": "afternoon", "duration_hours": 2,
            "crop": "Sugarcane", "urgency": "normal",
        },
    )
    second = client.post("/api/v1/mediation/accept").json()
    assert second["agreement"]["version"] == 2
    assert second["agreement"]["supersedes_id"] is not None

    rows = db_session.query(Agreement).order_by(Agreement.version).all()
    assert [a.status for a in rows] == [AgreementStatus.SUPERSEDED, AgreementStatus.ACCEPTED]


# ---------- Jal Vigyani conflict decision: request_revision / escalate ----------


@pytest.fixture()
def jv_seed(db_session):
    from app.models.conflict import Conflict

    db_session.add(Village(id=2, name="Rampur JV"))
    db_session.add(
        Dam(id=2, name="Rampur JV Dam", village_id=2, total_available=4200,
            current_storage=5000, inflow=850, outflow=700)
    )
    db_session.add(Canal(id=2, dam_id=2, name="C-JV", capacity=1200, current_flow=1000, water_level=2.4))
    conflict = Conflict(
        conflict_code="CNF-2-0001", canal_id=2, total_demand=1200,
        available_water=1000, shortage=200,
    )
    db_session.add(conflict)
    db_session.commit()
    return conflict


@pytest.fixture()
def jv_client(db_session):
    def override_db():
        try:
            yield db_session
        finally:
            pass

    def override_user():
        return AuthUser(user_id="clerk-jv-1", role="jal_vigyani", dam_id=2)

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[require_jal_vigyani] = override_user
    app.dependency_overrides[require_jal_vigyani_dam_id] = lambda: 2
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_decide_conflict_request_revision(jv_client, jv_seed):
    resp = jv_client.post(
        f"/api/v1/conflicts/{jv_seed.id}/decision",
        json={"action": "request_revision", "note": "recheck demand"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "revision_requested"


def test_decide_conflict_escalate(jv_client, jv_seed):
    resp = jv_client.post(
        f"/api/v1/conflicts/{jv_seed.id}/decision", json={"action": "escalate"}
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "escalated"
