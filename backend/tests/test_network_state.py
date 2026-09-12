"""GET /api/v1/network/state — the 3D digital twin feed.

Verifies the endpoint composes real dam/canal/farmer/conflict rows (via the
existing dashboard/jal-vigyani/conflict services) rather than inventing
anything, and that farmer/Jal Vigyani/dam-operator identities each resolve
to the right dam.
"""

from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.auth import AuthUser, require_any_role
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.enums import PriorityLevel
from app.models.farmer import Farmer, Field
from app.models.network import Canal, Dam
from app.models.request import WaterRequest
from app.models.village import Village
from app.services.mediation import run_allocation_cycle

CLERK_IDS = {"f1": "clerk-farmer-1", "f2": "clerk-farmer-2"}
_current = {"key": "f1", "role": "farmer", "dam_id": None}


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
            id=1, name="Rampur Dam", village_id=1,
            total_available=4200, current_storage=5000, inflow=850, outflow=700,
        )
    )
    db_session.add(Canal(id=1, dam_id=1, name="C1", capacity=1200, current_flow=1000, water_level=2.4))
    db_session.flush()

    farmers = {}
    for key, name in (("f1", "Head Farmer"), ("f2", "Tail Farmer")):
        farmer = Farmer(
            clerk_user_id=CLERK_IDS[key], name=name, village_id=1,
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

    # Both farmers request more than the canal can supply -> a real shortage
    # + conflict, so the twin has something other than "normal" to show.
    canal = db_session.get(Canal, 1)
    for key, qty in (("f1", 700), ("f2", 700)):
        req = WaterRequest(
            farmer_id=farmers[key].id, quantity_requested=qty, request_date=date(2026, 9, 12),
            preferred_time="morning", duration_hours=2, crop="Sugarcane",
        )
        db_session.add(req)
    db_session.commit()
    run_allocation_cycle(db_session, canal, actor_id="test")
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
        return AuthUser(
            user_id=CLERK_IDS.get(_current["key"], _current["key"]),
            role=_current["role"],
            dam_id=_current["dam_id"],
        )

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[require_any_role] = override_user
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def as_farmer(key: str):
    _current.update(key=key, role="farmer", dam_id=None)


def as_jal_vigyani(dam_id: int = 1):
    _current.update(key="clerk-jv-1", role="jal_vigyani", dam_id=dam_id)


def test_farmer_sees_own_dam_network_with_real_shortage(client, seed):
    as_farmer("f1")
    response = client.get("/api/v1/network/state")
    assert response.status_code == 200
    body = response.json()

    assert body["is_simulated"] is True
    assert body["dam"]["dam_id"] == 1
    assert len(body["canals"]) == 1
    canal = body["canals"][0]
    assert canal["canal_id"] == 1
    assert canal["current_flow"] == 1000
    assert body["total_active_conflicts"] == 1

    farmers = {f["farmer_id"]: f for f in canal["farmers"]}
    assert len(farmers) == 2
    # Demand (1400) exceeds supply (1000): both farmers should be flagged,
    # and the numbers must match exactly what the allocation engine wrote.
    for f in farmers.values():
        assert f["requested"] == 700
        assert f["has_conflict"] is True
        assert f["twin_status"] == "conflict"


def test_head_and_tail_position_labels(client, seed):
    as_farmer("f1")
    response = client.get("/api/v1/network/state")
    farmers = response.json()["canals"][0]["farmers"]
    by_index = sorted(farmers, key=lambda f: f["order_index"])
    assert by_index[0]["position_label"] == "head"
    assert by_index[-1]["position_label"] == "tail"


def test_jal_vigyani_sees_the_same_dam_state(client, seed):
    as_jal_vigyani(dam_id=1)
    response = client.get("/api/v1/network/state")
    assert response.status_code == 200
    assert response.json()["dam"]["dam_id"] == 1
    assert response.json()["total_active_conflicts"] == 1


def test_farmer_without_canal_gets_404_not_a_crash(client, db_session):
    db_session.add(Village(id=1, name="Rampur"))
    db_session.add(
        Farmer(clerk_user_id=CLERK_IDS["f1"], name="No Canal Farmer", village_id=1, phone="+911")
    )
    db_session.commit()
    as_farmer("f1")
    response = client.get("/api/v1/network/state")
    assert response.status_code == 404


def test_dam_operator_without_dam_id_gets_404(client, seed):
    _current.update(key="clerk-dam-1", role="dam_operator", dam_id=None)
    response = client.get("/api/v1/network/state")
    assert response.status_code == 404


# ---------- Perf cache (app/services/network_state.py::_state_cache) ----------
# Each round trip to a remote Postgres costs ~300-500ms regardless of query
# complexity, and the twin polls every 10s — this cache is what protects
# multiple simultaneous viewers of the same dam from each re-paying that
# cost. It must never serve one test's/dam's data to another, and must
# never serve stale data past a real mutation.


def test_second_call_within_ttl_is_served_from_cache(db_session, seed, monkeypatch):
    from app.core.auth import AuthUser
    from app.services import network_state

    user = AuthUser(user_id=CLERK_IDS["f1"], role="farmer")
    farmer = db_session.query(Farmer).filter(Farmer.clerk_user_id == CLERK_IDS["f1"]).one()

    first = network_state.build_network_state(db_session, user, farmer)

    def _boom(*args, **kwargs):
        raise AssertionError("should not recompute — the cached copy should be served instead")

    # resolve_dam_id (cheap: one canal lookup) still runs even on a cache
    # hit, to get the cache key — only the expensive composition should be
    # skipped.
    monkeypatch.setattr(network_state.dashboard_endpoints, "dam_summary", _boom)
    second = network_state.build_network_state(db_session, user, farmer)
    assert second is first


def test_mutation_invalidates_the_cache(db_session, seed):
    from app.core.auth import AuthUser
    from app.services import network_state

    user = AuthUser(user_id=CLERK_IDS["f1"], role="farmer")
    farmer = db_session.query(Farmer).filter(Farmer.clerk_user_id == CLERK_IDS["f1"]).one()
    canal = db_session.get(Canal, 1)

    before = network_state.build_network_state(db_session, user, farmer)
    before_farmer = next(f for f in before["canals"][0]["farmers"] if f["farmer_id"] == farmer.id)
    assert before_farmer["requested"] == 700

    # A fresh request on the same canal is exactly the kind of mutation a
    # farmer might make between two 10s twin polls.
    db_session.add(
        WaterRequest(
            farmer_id=farmer.id, quantity_requested=200, request_date=date(2026, 9, 13),
            preferred_time="evening", duration_hours=1, crop="Sugarcane",
        )
    )
    db_session.commit()
    run_allocation_cycle(db_session, canal, actor_id="test")
    db_session.commit()

    after = network_state.build_network_state(db_session, user, farmer)
    assert after is not before
