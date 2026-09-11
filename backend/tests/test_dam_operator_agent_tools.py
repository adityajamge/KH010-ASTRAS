"""Dam operator chat-agent tools: call each tool directly (no LLM, no
network) and check it's grounded in real seeded data and reuses the same
dam-scoped endpoint code as the manual UI flow."""

import json

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.auth import AuthUser
from app.db.base import Base
from app.models.network import Dam
from app.models.village import Village
from app.services.dam_operator_agent_tools import build_dam_operator_tools

USER = AuthUser(user_id="clerk-dam-op-1", role="dam_operator", dam_id=1)


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
            id=1, name="Rampur Dam", village_id=1, total_available=4200,
            current_storage=5000, inflow=850, outflow=700, water_level=12.5,
            rainfall_last_24h=10, rainfall_forecast="Light rain expected",
        )
    )
    db_session.commit()


def _tool(tools, name):
    return next(t for t in tools if t.name == name)


def test_get_dam_dashboard_reflects_real_seed(db_session, seed):
    tools = build_dam_operator_tools(db_session, USER, "en")
    result = json.loads(_tool(tools, "get_dam_dashboard").invoke({}))
    assert result["dam_name"] == "Rampur Dam"


def test_get_dam_details_returns_exact_numbers(db_session, seed):
    tools = build_dam_operator_tools(db_session, USER, "en")
    result = json.loads(_tool(tools, "get_dam_details").invoke({}))
    assert result["current_storage"] == 5000
    assert result["inflow"] == 850


def test_publish_supply_state_updates_only_given_fields(db_session, seed):
    tools = build_dam_operator_tools(db_session, USER, "en")
    out = _tool(tools, "publish_supply_state").invoke({"current_storage": 4800})
    result = json.loads(out)
    assert result["current_storage"] == 4800
    assert result["inflow"] == 850  # untouched

    dam = db_session.get(Dam, 1)
    assert float(dam.current_storage) == 4800
    assert float(dam.inflow) == 850


def test_tools_error_gracefully_without_dam_assignment(db_session, seed):
    user_no_dam = AuthUser(user_id="clerk-dam-op-2", role="dam_operator", dam_id=None)
    tools = build_dam_operator_tools(db_session, user_no_dam, "en")
    out = _tool(tools, "get_dam_dashboard").invoke({})
    assert out.startswith("Error:")
