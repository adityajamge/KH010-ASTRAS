"""PS14 loopholes doc §2.3/§2.5/§10.2: a farmer must be able to withdraw a
request, and a new submission must replace (not silently duplicate) an
existing open one — the exact "ghost claim" bug found live: a farmer ended
up with two simultaneous open requests on the same canal, one of them
invisible to the Mediation UI, silently consuming canal capacity."""

from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.auth import AuthUser, require_farmer
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.enums import PriorityLevel, RequestStatus
from app.models.farmer import Farmer, Field
from app.models.network import Canal, Dam
from app.models.request import Allocation, Schedule, WaterRequest
from app.models.village import Village

CLERK_ID = "clerk-farmer-1"
REQUEST = {
    "quantity_requested": 400, "request_date": date.today().isoformat(),
    "preferred_time": "morning", "duration_hours": 2,
    "crop": "Sugarcane", "urgency": "normal",
}


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
    farmer = Farmer(clerk_user_id=CLERK_ID, name="Farmer A", village_id=1,
                     phone="+91 90000 00000", canal_id=1)
    db_session.add(farmer)
    db_session.flush()
    db_session.add(Field(farmer_id=farmer.id, area_acres=2.5, crop="Sugarcane",
                          crop_stage="Tillering", priority=PriorityLevel.NORMAL))
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
        return AuthUser(user_id=CLERK_ID, role="farmer")

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[require_farmer] = override_user
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_cancel_releases_the_open_request(client, seed, db_session):
    resp = client.post("/api/v1/requests", json=REQUEST)
    assert resp.status_code == 201, resp.text
    req_id = resp.json()["id"]

    cancel_resp = client.post("/api/v1/requests/cancel")
    assert cancel_resp.status_code == 200, cancel_resp.text
    assert cancel_resp.json()["status"] == "cancelled"

    req = db_session.get(WaterRequest, req_id)
    assert req.status == RequestStatus.CANCELLED

    allocation = db_session.query(Allocation).filter_by(request_id=req_id).one()
    assert allocation.status.value == "cancelled"
    schedule = db_session.query(Schedule).filter_by(allocation_id=allocation.id).first()
    assert schedule is None or schedule.status.value == "cancelled"


def test_cancel_with_no_open_request_returns_404(client, seed):
    resp = client.post("/api/v1/requests/cancel")
    assert resp.status_code == 404


def test_new_submission_supersedes_the_old_open_request_instead_of_duplicating(
    client, seed, db_session
):
    """The exact bug: submitting twice must never leave two simultaneous
    open requests silently competing for the same canal."""
    first = client.post("/api/v1/requests", json=REQUEST)
    assert first.status_code == 201
    first_id = first.json()["id"]

    second = client.post("/api/v1/requests", json={**REQUEST, "quantity_requested": 600})
    assert second.status_code == 201
    second_id = second.json()["id"]

    first_req = db_session.get(WaterRequest, first_id)
    assert first_req.status == RequestStatus.CANCELLED

    open_requests = (
        db_session.query(WaterRequest)
        .filter(WaterRequest.farmer_id == seed.id, WaterRequest.status == RequestStatus.PROPOSED)
        .all()
    )
    assert [r.id for r in open_requests] == [second_id]

    # The canal must see only the surviving request as demand — not both.
    summary = client.get("/api/v1/dashboard/farmer").json()
    assert summary["allocated_water"] == 600
