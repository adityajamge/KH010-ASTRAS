"""Dam operator dashboard backend: supply state, release rows, PATCH publish.

Same throwaway-SQLite + dependency-override pattern as
tests/test_farmer_dashboard.py.
"""

from datetime import date, time

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api.v1.endpoints.dams import require_dam_scoped_role
from app.core.auth import AuthUser, require_dam_operator
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.enums import AllocationStatus, PriorityLevel, RequestStatus
from app.models.farmer import Farmer, Field
from app.models.monitoring import Anomaly
from app.models.enums import AnomalyStatus
from app.models.network import Canal, Dam
from app.models.request import Allocation, Delivery, WaterRequest
from app.models.system import AuditLog
from app.models.village import Village

DAM_USER = AuthUser(user_id="clerk-dam-1", role="dam_operator", dam_id=1)
FARMER_USER = AuthUser(user_id="clerk-farmer-9", role="farmer")


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
            water_level=118.4,
            rainfall_last_24h=18,
            rainfall_forecast="Medium — 12mm expected over next 24h",
        )
    )
    db_session.add(
        Canal(id=1, dam_id=1, name="C1", capacity=1200, current_flow=1000, water_level=2.4)
    )
    db_session.add(
        Canal(id=2, dam_id=1, name="C2", capacity=1000, current_flow=820, water_level=2.1)
    )
    farmer = Farmer(
        clerk_user_id=FARMER_USER.user_id,
        name="Farmer A",
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
    req = WaterRequest(
        farmer_id=farmer.id,
        quantity_requested=400,
        request_date=date(2026, 9, 12),
        preferred_time="morning",
        duration_hours=2,
        crop="Sugarcane",
        urgency=PriorityLevel.NORMAL,
        status=RequestStatus.PROPOSED,
    )
    db_session.add(req)
    db_session.flush()
    alloc = Allocation(
        request_id=req.id,
        farmer_id=farmer.id,
        allocated_quantity=350,
        allocation_date=date(2026, 9, 12),
        time_start=time(6, 0),
        time_end=time(8, 0),
        status=AllocationStatus.PROPOSED,
    )
    db_session.add(alloc)
    db_session.flush()
    db_session.add(
        Delivery(
            allocation_id=alloc.id,
            allocated_quantity=350,
            delivered_quantity=280,
        )
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

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[require_dam_operator] = lambda: DAM_USER
    app.dependency_overrides[require_dam_scoped_role] = lambda: DAM_USER
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_dam_summary_stats_and_releases(client, seed):
    body = client.get("/api/v1/dashboard/dam").json()
    assert body["dam_name"] == "Rampur Dam"
    stats = {s["label"]: s for s in body["stats"]}
    assert stats["Reservoir Level"]["value"] == "118.4 m"
    assert stats["Dam Status"]["value"] == "Normal"
    assert stats["Rainfall"]["value"] == "18 mm"
    assert stats["Emergency Alerts"]["value"] == "0"

    rows = {r["canal"]: r for r in body["releases"]}
    assert set(rows) == {"C1", "C2"}
    c1 = rows["C1"]
    assert c1["requested"] == 400
    assert c1["approved"] == 350
    assert c1["released"] == 1000
    assert c1["received"] == 280
    assert c1["difference"] == 720
    assert c1["status"] == "Needs Investigation"
    c2 = rows["C2"]
    assert c2["requested"] == c2["approved"] == c2["received"] == 0
    assert c2["status"] == "Normal"

    assert body["rainfall"]["last_24h"] == 18
    assert "C1" in body["rainfall"]["catchment"]


def test_flow_chain_accounting(client, seed):
    body = client.get("/api/v1/dashboard/dam").json()
    chain = body["flow_chain"]
    labels = [s["label"] for s in chain["stages"]]
    assert labels == [
        "Reservoir Release",
        "Canal Received",
        "Farmer Allocations",
        "Actual Delivery",
        "Expected Physical Loss",
        "Unaccounted Difference",
    ]
    values = {s["label"]: s["value"] for s in chain["stages"]}
    assert values["Reservoir Release"] == 700
    assert values["Canal Received"] == 1820  # C1 1000 + C2 820
    assert values["Farmer Allocations"] == 350
    assert values["Actual Delivery"] == 280
    assert values["Expected Physical Loss"] == round(1820 * 0.08, 2)
    assert chain["unaccounted"] == round(1820 - 280 - 1820 * 0.08, 2)
    assert chain["alert"] is True  # fresh system: nothing delivered yet
    assert chain["alert_note"]


def test_open_anomaly_counts_as_emergency(client, seed, db_session):
    db_session.add(
        Anomaly(
            canal_id=1,
            code="ANM-001",
            location="C1 / G2",
            expected_value=700,
            measured_value=680,
            difference=20,
            status=AnomalyStatus.INVESTIGATION_REQUIRED,
            possible_causes=["Leakage"],
        )
    )
    db_session.commit()
    body = client.get("/api/v1/dashboard/dam").json()
    stats = {s["label"]: s for s in body["stats"]}
    assert stats["Emergency Alerts"]["value"] == "1"


def test_publish_supply_state_updates_and_audits(client, seed, db_session):
    response = client.patch(
        "/api/v1/dam",
        json={"current_storage": 4600, "inflow": 900, "rainfall_last_24h": 22},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["current_storage"] == 4600
    assert body["inflow"] == 900
    assert body["rainfall_last_24h"] == 22
    assert body["outflow"] == 700  # untouched fields stay

    audit = db_session.query(AuditLog).filter_by(action="dam.supply_updated").one()
    assert audit.actor_type.value == "dam_operator"

    summary = client.get("/api/v1/dashboard/dam").json()
    stats = {s["label"]: s for s in summary["stats"]}
    assert stats["Storage Volume"]["value"] == "4,600 units"


def test_dam_read_includes_new_columns(client, seed):
    body = client.get("/api/v1/dam").json()
    assert body["water_level"] == 118.4
    assert body["rainfall_last_24h"] == 18


def test_farmer_role_is_rejected_by_dam_guard():
    """The real guard behind Depends() refuses non-operators with 403."""
    import asyncio

    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc:
        asyncio.run(require_dam_operator(user=FARMER_USER))
    assert exc.value.status_code == 403
    assert asyncio.run(require_dam_operator(user=DAM_USER)) == DAM_USER
