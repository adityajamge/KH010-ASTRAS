"""PS14 loophole audit §1.4 / §9.1 / §9.2 / §9.5 — a manually-entered flow
reading must be sanity-checked before it reaches the water balance: no
negative/non-finite values, nothing physically larger than the canal can
carry, and no implausible jump from the last reading at the same location.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.auth import require_jal_vigyani_dam_id
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.network import Canal, Dam
from app.models.village import Village

CANAL_CAPACITY = 1200


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
        Dam(id=1, name="Rampur Dam", village_id=1, total_available=4200, current_storage=5000, inflow=850, outflow=700)
    )
    db_session.add(Canal(id=1, dam_id=1, name="C1", capacity=CANAL_CAPACITY, current_flow=1000, water_level=2.4))
    db_session.commit()


@pytest.fixture()
def client(db_session):
    def override_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[require_jal_vigyani_dam_id] = lambda: 1
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def _reading(flow: float, water_level: float = 2.0, location: str = "Head Outlet"):
    return {"canal_id": 1, "location": location, "flow": flow, "water_level": water_level}


def test_normal_reading_is_accepted(client, seed):
    response = client.post("/api/v1/monitoring/sensor-readings", json=_reading(500))
    assert response.status_code == 201, response.text


def test_negative_flow_is_rejected(client, seed):
    response = client.post("/api/v1/monitoring/sensor-readings", json=_reading(-50))
    assert response.status_code == 400
    assert "negative" in response.json()["detail"].lower()


def test_negative_water_level_is_rejected(client, seed):
    response = client.post("/api/v1/monitoring/sensor-readings", json=_reading(500, water_level=-1))
    assert response.status_code == 400


def test_flow_far_beyond_canal_capacity_is_rejected(client, seed):
    # 1.5x capacity is the allowed slack — well past it is physically impossible.
    response = client.post("/api/v1/monitoring/sensor-readings", json=_reading(CANAL_CAPACITY * 3))
    assert response.status_code == 400
    assert "capacity" in response.json()["detail"].lower()


def test_wild_jump_from_last_reading_at_same_location_is_rejected(client, seed):
    # Both readings stay well under the capacity cap so this exercises the
    # rate-of-change check specifically, not the absolute-capacity one.
    first = client.post("/api/v1/monitoring/sensor-readings", json=_reading(100, location="Outlet A"))
    assert first.status_code == 201

    spike = client.post(
        "/api/v1/monitoring/sensor-readings", json=_reading(500, location="Outlet A")
    )
    assert spike.status_code == 400
    assert "jump" in spike.json()["detail"].lower()


def test_reasonable_change_from_last_reading_is_accepted(client, seed):
    first = client.post("/api/v1/monitoring/sensor-readings", json=_reading(500, location="Outlet B"))
    assert first.status_code == 201

    second = client.post(
        "/api/v1/monitoring/sensor-readings", json=_reading(650, location="Outlet B")
    )
    assert second.status_code == 201


def test_jump_check_is_scoped_per_location(client, seed):
    """A real jump at a *different* measurement point on the same canal must
    not be blocked by an unrelated location's last reading."""
    assert client.post(
        "/api/v1/monitoring/sensor-readings", json=_reading(500, location="Outlet A")
    ).status_code == 201
    # A brand-new location has no prior reading to jump from.
    assert client.post(
        "/api/v1/monitoring/sensor-readings", json=_reading(1100, location="Outlet C")
    ).status_code == 201
