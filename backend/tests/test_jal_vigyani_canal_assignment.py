"""Reassigning a farmer's canal must immediately recompute allocations on
both the canal they left and the one they joined — otherwise a farmer's
persisted allocation/reason goes stale relative to the live evidence the
mediation view recomputes on every read, which is exactly what happened in
production: a farmer moved onto a canal with an existing competing claim
kept showing "fully allocated, no shortage" long after a real conflict
existed."""

from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.auth import AuthUser, require_farmer, require_jal_vigyani, require_jal_vigyani_dam_id
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.enums import PriorityLevel
from app.models.farmer import Farmer, Field
from app.models.network import Canal, Dam
from app.models.request import Allocation, WaterRequest
from app.models.village import Village

CLERK_A = "clerk-farmer-a"
CLERK_B = "clerk-farmer-b"
_current = {"key": CLERK_A}


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
    db_session.add(Canal(id=2, dam_id=1, name="C2", capacity=1000, current_flow=1000, water_level=2.1))
    farmer_a = Farmer(clerk_user_id=CLERK_A, name="Farmer A", village_id=1,
                       phone="+91 90000 00001", canal_id=1)
    farmer_b = Farmer(clerk_user_id=CLERK_B, name="Farmer B", village_id=1,
                       phone="+91 90000 00002", canal_id=2)
    db_session.add_all([farmer_a, farmer_b])
    db_session.flush()
    for f in (farmer_a, farmer_b):
        db_session.add(Field(farmer_id=f.id, area_acres=2.5, crop="Sugarcane",
                              crop_stage="Tillering", priority=PriorityLevel.NORMAL))
    db_session.commit()
    return {"a": farmer_a, "b": farmer_b}


@pytest.fixture()
def farmer_client(db_session):
    def override_db():
        try:
            yield db_session
        finally:
            pass

    def override_user():
        return AuthUser(user_id=_current["key"], role="farmer")

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[require_farmer] = override_user
    with TestClient(app, raise_server_exceptions=False) as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture()
def jv_client(db_session):
    def override_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[require_jal_vigyani] = lambda: AuthUser(
        user_id="clerk-jv-1", role="jal_vigyani", dam_id=1
    )
    app.dependency_overrides[require_jal_vigyani_dam_id] = lambda: 1
    with TestClient(app, raise_server_exceptions=False) as client:
        yield client
    app.dependency_overrides.clear()


def test_moving_farmer_onto_a_contested_canal_recomputes_both_sides(
    db_session, seed, farmer_client, jv_client
):
    req = {
        "quantity_requested": 700, "request_date": date.today().isoformat(),
        "preferred_time": "morning", "duration_hours": 2,
        "crop": "Sugarcane", "urgency": "normal",
    }
    _current["key"] = CLERK_A
    assert farmer_client.post("/api/v1/requests", json=req).status_code == 201

    _current["key"] = CLERK_B
    assert farmer_client.post("/api/v1/requests", json=req).status_code == 201

    # Before the move: each farmer is alone on their own canal, no shortage.
    alloc_a = db_session.query(Allocation).join(
        WaterRequest, Allocation.request_id == WaterRequest.id
    ).filter(WaterRequest.farmer_id == seed["a"].id).one()
    assert float(alloc_a.allocated_quantity) == 700
    assert "shortage 0.00" in alloc_a.reason.lower()

    # Move Farmer B onto Farmer A's canal (C1) — now they compete for the
    # same 1000 units with a combined demand of 1400.
    resp = jv_client.patch(f"/api/v1/jal-vigyani/farmers/{seed['b'].id}/canal", json={"canal_id": 1})
    assert resp.status_code == 200, resp.text

    db_session.refresh(alloc_a)
    assert float(alloc_a.allocated_quantity) < 700, (
        "Farmer A's persisted allocation must be recomputed the instant "
        "a competing farmer joins their canal, not left stale."
    )
    assert "shortage" in alloc_a.reason.lower()
    assert "400.00" in alloc_a.reason or "conflict detected" in alloc_a.reason.lower()

    alloc_b = db_session.query(Allocation).join(
        WaterRequest, Allocation.request_id == WaterRequest.id
    ).filter(WaterRequest.farmer_id == seed["b"].id).one()
    assert float(alloc_b.allocated_quantity) < 700
    assert float(alloc_a.allocated_quantity) + float(alloc_b.allocated_quantity) <= 1000.01
