"""Farmer chat-agent tools: call each tool directly (no LLM, no network) and
check it's grounded in real seeded data and reuses the same endpoint/service
code path as the manual UI flow — same numbers, same validation, same
commit behaviour."""

import json
from datetime import date

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.auth import AuthUser
from app.db.base import Base
from app.models.enums import PriorityLevel
from app.models.farmer import Farmer, Field
from app.models.network import Canal, Dam
from app.models.village import Village
from app.services.farmer_agent_tools import build_farmer_tools

USER = AuthUser(user_id="clerk-farmer-1", role="farmer")


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
    db_session.add(
        Dam(id=1, name="Rampur Dam", village_id=1, total_available=4200,
            current_storage=5000, inflow=850, outflow=700)
    )
    db_session.add(Canal(id=1, dam_id=1, name="C1", capacity=1200, current_flow=1000, water_level=2.4))
    f = Farmer(
        clerk_user_id=USER.user_id, name="Farmer A", village_id=1,
        phone="+91 90000 00000", canal_id=1,
    )
    db_session.add(f)
    db_session.flush()
    db_session.add(
        Field(farmer_id=f.id, area_acres=2.5, crop="Sugarcane",
              crop_stage="Tillering", priority=PriorityLevel.NORMAL)
    )
    db_session.commit()
    return f


def _tool(tools, name):
    return next(t for t in tools if t.name == name)


def test_get_dashboard_summary_reflects_real_canal_state(db_session, farmer):
    tools = build_farmer_tools(db_session, USER, "en")
    result = json.loads(_tool(tools, "get_dashboard_summary").invoke({}))
    assert result["available_water"] == 1000
    assert result["canal_name"] == "C1"
    assert result["has_request"] is False


def test_submit_water_request_persists_and_returns_allocation(db_session, farmer):
    tools = build_farmer_tools(db_session, USER, "en")
    out = _tool(tools, "submit_water_request").invoke(
        {
            "quantity_units": 300,
            "request_date": date.today().isoformat(),
            "preferred_time": "morning",
            "duration_hours": 2,
            "crop": "Sugarcane",
            "urgency": "normal",
        }
    )
    result = json.loads(out)
    assert result["quantity_requested"] == 300
    assert result["status"] == "proposed"

    summary = json.loads(_tool(tools, "get_dashboard_summary").invoke({}))
    assert summary["allocated_water"] == 300


def test_submit_water_request_rejects_past_date(db_session, farmer):
    tools = build_farmer_tools(db_session, USER, "en")
    out = _tool(tools, "submit_water_request").invoke(
        {
            "quantity_units": 300,
            "request_date": "2020-01-01",
            "preferred_time": "morning",
            "duration_hours": 2,
            "crop": "Sugarcane",
            "urgency": "normal",
        }
    )
    assert out.startswith("Error:")
    assert "past" in out.lower()


def test_submit_objection_invalid_reason_is_caught_before_hitting_the_engine(db_session, farmer):
    tools = build_farmer_tools(db_session, USER, "en")
    out = _tool(tools, "submit_objection").invoke({"reason": "NOT_A_REAL_REASON"})
    assert out.startswith("Error:")


def test_accept_current_proposal_without_a_request_returns_error_not_crash(db_session, farmer):
    tools = build_farmer_tools(db_session, USER, "en")
    out = _tool(tools, "accept_current_proposal").invoke({})
    assert out.startswith("Error:")
