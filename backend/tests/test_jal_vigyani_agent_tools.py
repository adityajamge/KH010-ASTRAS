"""Jal Vigyani chat-agent tools: call each tool directly (no LLM, no
network) and check it's grounded in real seeded data and reuses the same
dam-scoped endpoint code as the manual UI flow."""

import json

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.auth import AuthUser
from app.db.base import Base
from app.models.conflict import Conflict, ConflictParticipant, Objection
from app.models.enums import ObjectionReason, ObjectionStatus, PriorityLevel
from app.models.farmer import Farmer, Field
from app.models.network import Canal, Dam
from app.models.village import Village
from app.services.jal_vigyani_agent_tools import build_jal_vigyani_tools

USER = AuthUser(user_id="clerk-jv-1", role="jal_vigyani", dam_id=1)


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
        clerk_user_id="clerk-farmer-1", name="Farmer A", village_id=1,
        phone="+91 90000 00000", canal_id=1,
    )
    db_session.add(farmer)
    db_session.flush()
    db_session.add(
        Field(farmer_id=farmer.id, area_acres=2.5, crop="Sugarcane",
              crop_stage="Tillering", priority=PriorityLevel.NORMAL)
    )
    conflict = Conflict(
        conflict_code="CNF-1-0001", canal_id=1, total_demand=1200,
        available_water=1000, shortage=200,
    )
    db_session.add(conflict)
    db_session.flush()
    db_session.add(ConflictParticipant(conflict_id=conflict.id, farmer_id=farmer.id))
    db_session.add(
        Objection(
            conflict_id=conflict.id, farmer_id=farmer.id,
            reason=ObjectionReason.CROP_CRITICAL, details="wilting",
            status=ObjectionStatus.PENDING, mediator_message="Grounded reply.",
        )
    )
    db_session.commit()
    return {"farmer": farmer, "conflict": conflict}


def _tool(tools, name):
    return next(t for t in tools if t.name == name)


def test_get_dam_overview_reflects_real_seed(db_session, seed):
    tools = build_jal_vigyani_tools(db_session, USER, "en")
    result = json.loads(_tool(tools, "get_dam_overview").invoke({}))
    assert result["dam"]["name"] == "Rampur Dam"
    assert result["farmer_count"] == 1
    assert result["active_conflicts"] == 1


def test_list_conflicts_and_get_detail_includes_mediator_message(db_session, seed):
    tools = build_jal_vigyani_tools(db_session, USER, "en")
    conflicts = json.loads(_tool(tools, "list_conflicts_tool").invoke({}))
    assert len(conflicts) == 1
    conflict_id = conflicts[0]["id"]

    detail = json.loads(_tool(tools, "get_conflict_detail").invoke({"conflict_id": conflict_id}))
    assert detail["conflict_code"] == "CNF-1-0001"
    assert len(detail["objections"]) == 1
    assert detail["objections"][0]["mediator_message"] == "Grounded reply."


def test_decide_conflict_rejects_invalid_action(db_session, seed):
    tools = build_jal_vigyani_tools(db_session, USER, "en")
    out = _tool(tools, "decide_conflict").invoke(
        {"conflict_id": seed["conflict"].id, "action": "not_a_real_action"}
    )
    assert out.startswith("Error:")


def test_decide_conflict_approves_and_persists(db_session, seed):
    tools = build_jal_vigyani_tools(db_session, USER, "en")
    out = _tool(tools, "decide_conflict").invoke(
        {"conflict_id": seed["conflict"].id, "action": "approve", "note": "looks fair"}
    )
    result = json.loads(out)
    assert result["status"] == "approved"

    db_session.refresh(seed["conflict"])
    assert seed["conflict"].status.value == "approved"


def test_assign_farmer_canal_rejects_canal_from_another_dam(db_session, seed):
    db_session.add(Dam(id=2, name="Other Dam", village_id=1, total_available=100,
                        current_storage=100, inflow=10, outflow=10))
    db_session.add(Canal(id=2, dam_id=2, name="C2-other-dam", capacity=500, current_flow=400, water_level=1.0))
    db_session.commit()

    tools = build_jal_vigyani_tools(db_session, USER, "en")
    out = _tool(tools, "assign_farmer_canal").invoke(
        {"farmer_id": seed["farmer"].id, "canal_id": 2}
    )
    assert out.startswith("Error:")


def test_tools_error_gracefully_without_dam_assignment(db_session, seed):
    user_no_dam = AuthUser(user_id="clerk-jv-2", role="jal_vigyani", dam_id=None)
    with pytest.raises(Exception):
        build_jal_vigyani_tools(db_session, user_no_dam, "en")
