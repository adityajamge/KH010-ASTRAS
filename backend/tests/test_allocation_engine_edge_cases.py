"""Decision-logic edge cases the happy-path tests in test_farmer_dashboard.py
don't exercise: the floors-don't-fit fallback, the iterative proportional
redistribution loop actually looping more than once, canal-capacity capping,
and the "evidence-backed unchanged" objection outcome PS14 explicitly calls
for (not just the "objection helps" case)."""

from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.auth import AuthUser, require_farmer
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.enums import ObjectionReason, PriorityLevel
from app.models.farmer import Farmer, Field
from app.models.network import Canal, Dam
from app.models.village import Village
from app.services.allocation import Claim, allocate
from app.services.mediation import canal_available_water

TEST_CLERK_IDS = {"f1": "clerk-farmer-1", "f2": "clerk-farmer-2"}
_current = {"key": "f1"}


# ---------- Pure engine edge cases (no DB) ----------


def test_canal_available_water_caps_at_capacity_not_current_flow():
    """PS14 §13: capacity is enforced by construction — a sensor reading
    above nameplate capacity must never inflate what's allocatable."""
    canal = Canal(current_flow=1500, capacity=1200)
    assert canal_available_water(canal) == 1200


def test_canal_available_water_floors_at_zero():
    canal = Canal(current_flow=-5, capacity=1200)
    assert canal_available_water(canal) == 0.0


def test_floors_dont_fit_falls_back_to_proportional_split():
    """When even 50% of every request can't fit, the engine must drop the
    floor guarantee (not violate the water balance) and split by weight."""
    outcome = allocate(100, [Claim(1, 21, 100), Claim(2, 22, 100), Claim(3, 23, 100)])
    assert outcome.has_conflict is True
    assert any("falling back to proportional split" in line for line in outcome.evidence)
    assert sum(outcome.allocations.values()) <= 100.01
    # Equal requests + equal (normal) priority -> an even three-way split.
    assert outcome.allocations == {21: 33.33, 22: 33.33, 23: 33.33}


def test_proportional_split_redistributes_leftover_across_iterations():
    """A small, high-priority claim can saturate (hit its own request cap)
    in the first pass; the loop must then redistribute the leftover pool to
    the remaining claim rather than leaving it unallocated."""
    outcome = allocate(
        1300,
        [
            Claim(1, 11, 200, PriorityLevel.CRITICAL),
            Claim(2, 12, 1400, PriorityLevel.NORMAL),
        ],
    )
    # The tightly-bound critical claim gets fully satisfied...
    assert outcome.allocations[11] == 200.0
    # ...and the larger claim absorbs the rest of the shortage, not a
    # naive weight-only split (which would under-allocate it).
    assert outcome.allocations[12] == 1100.0
    assert sum(outcome.allocations.values()) == 1300.0
    for rid, qty in outcome.allocations.items():
        requested = {11: 200, 12: 1400}[rid]
        assert qty <= requested + 0.01


# ---------- Objection "evidence-backed unchanged" path (endpoint-level) ----------


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
    farmers = {}
    for key, name in (("f1", "Farmer A"), ("f2", "Farmer B")):
        farmer = Farmer(
            clerk_user_id=TEST_CLERK_IDS[key], name=name, village_id=1,
            phone="+91 90000 00000", canal_id=1,
        )
        db_session.add(farmer)
        db_session.flush()
        db_session.add(
            Field(farmer_id=farmer.id, area_acres=2.5, crop="Sugarcane",
                  crop_stage="Tillering", priority=PriorityLevel.NORMAL)
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


def test_objection_with_no_shortage_is_evidence_backed_unchanged(client, seed):
    """PS14 §16: an objection can legitimately produce an *unchanged*
    proposal, backed by evidence — not every objection must move the
    number. With no scarcity, everyone already gets their full request, so
    boosting urgency changes nothing."""
    as_farmer("f1")
    resp = client.post(
        "/api/v1/requests",
        json={
            "quantity_requested": 400, "request_date": date.today().isoformat(),
            "preferred_time": "morning", "duration_hours": 2,
            "crop": "Sugarcane", "urgency": "normal",
        },
    )
    assert resp.status_code == 201, resp.text

    result = client.post(
        "/api/v1/mediation/objections",
        json={"reason": "NEED_MORE_WATER", "details": None},
    ).json()
    assert result["changed"] is False
    assert result["allocated"] == result["previous_allocated"] == 400
    assert result["urgency"] == "high"  # the boost still happened...
    assert result["evidence"]  # ...it's just evidence-backed as unnecessary


def test_second_objection_from_already_critical_farmer_stays_unchanged(client, seed, db_session):
    """The urgency boost is a no-op once a farmer is already CRITICAL
    (_URGENCY_BOOST[CRITICAL] = CRITICAL) — a real shortage is still in
    play here, so this also proves the *rerun* is idempotent, not just the
    no-shortage case above."""
    as_farmer("f1")
    client.post(
        "/api/v1/requests",
        json={
            "quantity_requested": 700, "request_date": date.today().isoformat(),
            "preferred_time": "morning", "duration_hours": 2,
            "crop": "Sugarcane", "urgency": "critical",
        },
    )
    as_farmer("f2")
    client.post(
        "/api/v1/requests",
        json={
            "quantity_requested": 700, "request_date": date.today().isoformat(),
            "preferred_time": "morning", "duration_hours": 2,
            "crop": "Sugarcane", "urgency": "critical",
        },
    )
    as_farmer("f1")
    first = client.post(
        "/api/v1/mediation/objections",
        json={"reason": "CROP_CRITICAL", "details": None},
    ).json()
    assert first["urgency"] == "critical"

    second = client.post(
        "/api/v1/mediation/objections",
        json={"reason": "CROP_CRITICAL", "details": "still critical"},
    ).json()
    assert second["urgency"] == "critical"  # no further boost possible
    assert second["changed"] is False
    assert second["allocated"] == first["allocated"]


def test_canal_capacity_caps_available_water_end_to_end(client, seed, db_session):
    """current_flow can exceed nameplate capacity (a sensor spike); the
    allocation must still be capped at capacity, not the raw reading."""
    canal = db_session.query(Canal).filter_by(id=1).one()
    canal.current_flow = 5000  # far above capacity=1200
    db_session.commit()

    as_farmer("f1")
    resp = client.post(
        "/api/v1/requests",
        json={
            "quantity_requested": 5000, "request_date": date.today().isoformat(),
            "preferred_time": "morning", "duration_hours": 2,
            "crop": "Sugarcane", "urgency": "normal",
        },
    )
    assert resp.status_code == 201, resp.text
    summary = client.get("/api/v1/dashboard/farmer").json()
    assert summary["available_water"] == 1200  # capacity, not 5000
    assert summary["allocated_water"] == 1200  # capped, not the full 5000 requested
