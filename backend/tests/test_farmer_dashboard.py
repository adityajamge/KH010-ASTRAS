"""Farmer dashboard backend: allocation engine + request/mediation endpoints.

Runs on a throwaway SQLite file (Postgres-only ARRAY columns carry a JSON
variant for sqlite) with auth/DB dependencies overridden — no network, no
Clerk, no Neon needed.
"""

from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.auth import AuthUser, require_farmer
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.conflict import Agreement, Conflict, Objection
from app.models.enums import (
    AgreementStatus,
    ConflictStatus,
    ObjectionReason,
    PriorityLevel,
)
from app.models.farmer import Farmer, Field
from app.models.network import Canal, Dam
from app.models.request import Allocation
from app.models.village import Village
from app.services.allocation import Claim, allocate, detect_shortage, plan_slots

TEST_CLERK_IDS = {"f1": "clerk-farmer-1", "f2": "clerk-farmer-2"}
_current = {"key": "f1"}


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
        Dam(
            id=1,
            name="Rampur Dam",
            village_id=1,
            total_available=4200,
            current_storage=5000,
            inflow=850,
            outflow=700,
        )
    )
    db_session.add(
        Canal(
            id=1,
            dam_id=1,
            name="C1",
            capacity=1200,
            current_flow=1000,
            water_level=2.4,
        )
    )
    farmers = {}
    for key, name in (("f1", "Farmer A"), ("f2", "Farmer B")):
        farmer = Farmer(
            clerk_user_id=TEST_CLERK_IDS[key],
            name=name,
            village_id=1,
            phone="+91 90000 00000",
            canal_id=1,
        )
        db_session.add(farmer)
        db_session.flush()
        db_session.add(
            Field(
                farmer_id=farmer.id,
                area_acres=2.5,
                crop="Sugarcane",
                crop_stage="Tillering",
                priority=PriorityLevel.NORMAL,
            )
        )
        farmers[key] = farmer
    db_session.commit()
    return farmers


@pytest.fixture()
def client(db_session):
    def override_db():
        try:
            yield db_session
        finally:
            pass

    def override_user():
        return AuthUser(user_id=TEST_CLERK_IDS[_current["key"]], role="farmer")

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[require_farmer] = override_user
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def as_farmer(key: str):
    _current["key"] = key


REQUEST = {
    "quantity_requested": 400,
    "request_date": "2026-09-12",
    "preferred_time": "morning",
    "duration_hours": 2,
    "crop": "Sugarcane",
    "urgency": "normal",
}


# ---------- Engine unit tests (no DB) ----------


def test_no_scarcity_allocates_everything():
    outcome = allocate(
        1000,
        [Claim(1, 11, 400), Claim(2, 12, 300)],
    )
    assert outcome.has_conflict is False
    assert outcome.shortage == 0
    assert outcome.allocations == {11: 400, 12: 300}


def test_scarcity_respects_balance_caps_and_floors():
    outcome = allocate(
        1000,
        [Claim(1, 11, 400), Claim(2, 12, 400), Claim(3, 13, 400)],
    )
    assert outcome.has_conflict is True
    assert outcome.shortage == 200
    assert sum(outcome.allocations.values()) <= 1000.01
    for rid, qty in outcome.allocations.items():
        assert qty <= 400.01
        assert qty >= 200 - 0.01  # 50% minimum fair share holds here
    assert outcome.evidence  # glass-box trail is never empty


def test_priority_weight_favours_critical_claim():
    outcome = allocate(
        500,
        [
            Claim(1, 11, 400, PriorityLevel.NORMAL),
            Claim(2, 12, 400, PriorityLevel.CRITICAL),
        ],
    )
    assert outcome.allocations[12] > outcome.allocations[11]


def test_detect_shortage():
    assert detect_shortage(1000, 1200) == 200
    assert detect_shortage(1000, 800) == 0


def test_slots_are_sequential_and_cover_quantity():
    slots = plan_slots(date(2026, 9, 12), [(1, 1, 350.0), (2, 2, 350.0)])
    assert slots[0].start < slots[0].end == slots[1].start < slots[1].end
    assert all(s.quantity > 0 for s in slots)


# ---------- Endpoint tests ----------


def test_submit_request_allocates_and_schedules(client, seed):
    as_farmer("f1")
    response = client.post("/api/v1/requests", json=REQUEST)
    assert response.status_code == 201, response.text

    summary = client.get("/api/v1/dashboard/farmer").json()
    assert summary["available_water"] == 1000
    assert summary["allocated_water"] == 400  # no scarcity yet: full request
    assert summary["remaining_water"] == 400  # nothing delivered yet
    assert summary["has_request"] is True
    assert len(summary["upcoming_schedules"]) == 1
    assert summary["current_allocation"]["status"] == "proposed"
    assert summary["notifications"], "submit + proposal + schedule must notify"


def test_shortage_creates_conflict_and_prorates(client, seed, db_session):
    as_farmer("f1")
    assert client.post("/api/v1/requests", json=REQUEST).status_code == 201
    as_farmer("f2")
    assert client.post("/api/v1/requests", json={**REQUEST, "quantity_requested": 800}).status_code == 201

    conflict = db_session.query(Conflict).one()
    assert conflict.status == ConflictStatus.DETECTED
    assert float(conflict.shortage) == 200

    total = sum(
        float(a.allocated_quantity)
        for a in db_session.query(Allocation).all()
    )
    assert total <= 1000.01

    summary = client.get("/api/v1/dashboard/farmer").json()
    assert summary["allocated_water"] < 800  # farmer B was cut by the engine


def test_objection_boosts_and_revises(client, seed, db_session):
    as_farmer("f1")
    client.post("/api/v1/requests", json=REQUEST)
    as_farmer("f2")
    client.post("/api/v1/requests", json={**REQUEST, "quantity_requested": 800})
    before = client.get("/api/v1/dashboard/farmer").json()["allocated_water"]

    response = client.post(
        "/api/v1/mediation/objections",
        json={"reason": "NEED_MORE_WATER", "details": "Crop stress"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["allocated"] >= before - 0.01  # boost never hurts the objector
    assert body["evidence"], "unchanged proposals must still carry evidence"
    assert (
        db_session.query(Objection).filter_by(reason=ObjectionReason.NEED_MORE_WATER).count()
        == 1
    )
    conflict = db_session.query(Conflict).one()
    assert conflict.status == ConflictStatus.NEGOTIATION


def test_accept_freezes_versioned_agreement(client, seed, db_session):
    as_farmer("f1")
    client.post("/api/v1/requests", json=REQUEST)
    response = client.post("/api/v1/mediation/accept")
    assert response.status_code == 200, response.text

    agreement = db_session.query(Agreement).one()
    assert agreement.status == AgreementStatus.ACCEPTED
    assert agreement.version == 1
    assert agreement.final_allocation  # frozen snapshot, not a live view
    assert agreement.participants


def test_farmer_isolation(client, seed):
    as_farmer("f1")
    client.post("/api/v1/requests", json=REQUEST)
    as_farmer("f2")
    summary = client.get("/api/v1/dashboard/farmer").json()
    assert summary["has_request"] is False
    assert summary["allocated_water"] == 0
    assert summary["requests"] == []
