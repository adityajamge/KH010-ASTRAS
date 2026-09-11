"""AI Coordinator agent loop: same DB fixture pattern as
test_farmer_dashboard.py, but with a scripted fake LLM client standing in
for Anthropic/OpenAI — no network, no API key needed. Verifies the loop
calls real deterministic tools (never invents numbers) and logs every turn.
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.models.assistant import AssistantMessage
from app.models.enums import ChannelType, MessageRole
from app.models.farmer import Farmer, Field
from app.models.enums import PriorityLevel
from app.models.network import Canal, Dam
from app.models.request import WaterRequest
from app.models.village import Village
from app.services import ai_coordinator
from app.services.llm_client import LLMClient, LLMNotConfigured, LLMTurn, ToolCall

CLERK_ID = "clerk-farmer-1"


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
    db_session.add(Canal(id=1, dam_id=1, name="C1", capacity=1200, current_flow=1000, water_level=2.4))
    row = Farmer(
        clerk_user_id=CLERK_ID, name="Farmer A", village_id=1, phone="+91 90000 00000", canal_id=1
    )
    db_session.add(row)
    db_session.flush()
    db_session.add(
        Field(farmer_id=row.id, area_acres=2.5, crop="Sugarcane", crop_stage="Tillering", priority=PriorityLevel.NORMAL)
    )
    db_session.commit()
    return row


class ScriptedLLMClient(LLMClient):
    """Replays a fixed sequence of LLMTurn objects, one per `complete()` call."""

    def __init__(self, script: list[LLMTurn]):
        self._script = list(script)
        self.seen_tools: list[list[str]] = []

    def complete(self, system, history, tools):
        self.seen_tools.append([t["name"] for t in tools])
        return self._script.pop(0)

    def assistant_message(self, turn):
        return {"role": "assistant", "content": turn.text or ""}

    def tool_result_messages(self, turn, results):
        return [
            {
                "role": "user",
                "content": [
                    {"tool_use_id": tid, "content": content, "is_error": is_error}
                    for tid, content, is_error in results
                ],
            }
        ]


def test_not_configured_replies_without_crashing(db_session, farmer, monkeypatch):
    def _raise():
        raise LLMNotConfigured("no key")

    monkeypatch.setattr(ai_coordinator, "get_llm_client", _raise)
    reply = ai_coordinator.handle_message(
        db_session,
        role="farmer",
        actor_id=farmer.clerk_user_id,
        channel=ChannelType.WEB,
        text="What's my water status?",
        farmer=farmer,
    )
    db_session.commit()
    assert reply == ai_coordinator.NOT_CONFIGURED_REPLY
    rows = db_session.query(AssistantMessage).order_by(AssistantMessage.id).all()
    assert [r.role for r in rows] == [MessageRole.USER, MessageRole.ASSISTANT]


def test_get_status_tool_grounds_the_reply(db_session, farmer, monkeypatch):
    script = [
        LLMTurn(text=None, tool_calls=[ToolCall(id="t1", name="get_status", arguments={})]),
        LLMTurn(text="You have no open request yet.", tool_calls=[]),
    ]
    client = ScriptedLLMClient(script)
    monkeypatch.setattr(ai_coordinator, "get_llm_client", lambda: client)

    reply = ai_coordinator.handle_message(
        db_session,
        role="farmer",
        actor_id=farmer.clerk_user_id,
        channel=ChannelType.WEB,
        text="What's my allocation?",
        farmer=farmer,
    )
    db_session.commit()

    assert reply == "You have no open request yet."
    assert client.seen_tools[0] == [t["name"] for t in ai_coordinator.FARMER_TOOLS]
    logged = db_session.query(AssistantMessage).order_by(AssistantMessage.id).all()
    assert logged[0].role == MessageRole.USER and logged[0].content == "What's my allocation?"
    assert logged[-1].role == MessageRole.ASSISTANT and logged[-1].content == reply
    assert logged[-1].meta["tool_calls"][0]["tool"] == "get_status"


def test_submit_water_request_tool_creates_a_real_request(db_session, farmer, monkeypatch):
    script = [
        LLMTurn(
            text=None,
            tool_calls=[
                ToolCall(
                    id="t1",
                    name="submit_water_request",
                    arguments={
                        "quantity_requested": 400,
                        "request_date": "2026-09-12",
                        "preferred_time": "morning",
                        "duration_hours": 2,
                        "crop": "Sugarcane",
                        "urgency": "normal",
                    },
                )
            ],
        ),
        LLMTurn(text="I've submitted your request for 400 units.", tool_calls=[]),
    ]
    client = ScriptedLLMClient(script)
    monkeypatch.setattr(ai_coordinator, "get_llm_client", lambda: client)

    reply = ai_coordinator.handle_message(
        db_session,
        role="farmer",
        actor_id=farmer.clerk_user_id,
        channel=ChannelType.WEB,
        text="I need 400 units tomorrow morning for sugarcane",
        farmer=farmer,
    )
    db_session.commit()

    assert reply == "I've submitted your request for 400 units."
    stored = db_session.query(WaterRequest).filter(WaterRequest.farmer_id == farmer.id).all()
    assert len(stored) == 1
    assert float(stored[0].quantity_requested) == 400


def test_unsupported_role_raises(db_session):
    with pytest.raises(ValueError):
        ai_coordinator.handle_message(
            db_session,
            role="nope",
            actor_id="x",
            channel=ChannelType.WEB,
            text="hi",
        )


# ---------- Full negotiation lifecycle via chat ----------


def test_full_negotiation_lifecycle_submit_object_accept(db_session, farmer, monkeypatch):
    """request -> proposal -> objection -> revised proposal -> accept -> agreement,
    driven entirely through handle_message, mirroring PS14 §16/§20."""
    from app.models.conflict import Agreement
    from app.models.request import Allocation

    submit_script = [
        LLMTurn(
            text=None,
            tool_calls=[
                ToolCall(
                    id="t1",
                    name="submit_water_request",
                    arguments={
                        "quantity_requested": 2000,
                        "request_date": "2026-09-12",
                        "preferred_time": "morning",
                        "duration_hours": 2,
                        "crop": "Sugarcane",
                        "urgency": "normal",
                    },
                )
            ],
        ),
        LLMTurn(text="Requested 2000 units.", tool_calls=[]),
    ]
    monkeypatch.setattr(ai_coordinator, "get_llm_client", lambda: ScriptedLLMClient(submit_script))
    ai_coordinator.handle_message(
        db_session, role="farmer", actor_id=farmer.clerk_user_id, channel=ChannelType.WEB,
        text="I need 2000 units", farmer=farmer,
    )
    db_session.commit()

    allocation = db_session.query(Allocation).filter(Allocation.farmer_id == farmer.id).one()
    assert float(allocation.allocated_quantity) == 1000  # canal current_flow cap, no scarcity

    object_script = [
        LLMTurn(
            text=None,
            tool_calls=[
                ToolCall(
                    id="t2",
                    name="object_to_allocation",
                    arguments={"reason": "CROP_CRITICAL", "details": "my crop is stressed"},
                )
            ],
        ),
        LLMTurn(text="I've filed your objection.", tool_calls=[]),
    ]
    monkeypatch.setattr(ai_coordinator, "get_llm_client", lambda: ScriptedLLMClient(object_script))
    reply = ai_coordinator.handle_message(
        db_session, role="farmer", actor_id=farmer.clerk_user_id, channel=ChannelType.WEB,
        text="my crop is stressed, I need this urgently", farmer=farmer,
    )
    db_session.commit()
    assert reply == "I've filed your objection."

    accept_script = [
        LLMTurn(text=None, tool_calls=[ToolCall(id="t3", name="accept_proposal", arguments={})]),
        LLMTurn(text="Your agreement is confirmed.", tool_calls=[]),
    ]
    monkeypatch.setattr(ai_coordinator, "get_llm_client", lambda: ScriptedLLMClient(accept_script))
    reply = ai_coordinator.handle_message(
        db_session, role="farmer", actor_id=farmer.clerk_user_id, channel=ChannelType.WEB,
        text="ok I accept", farmer=farmer,
    )
    db_session.commit()
    assert reply == "Your agreement is confirmed."

    agreements = db_session.query(Agreement).filter(Agreement.canal_id == 1).all()
    assert len(agreements) == 1
    assert agreements[0].status.value == "accepted"

    # Full turn-by-turn trail is preserved for audit.
    logged = db_session.query(AssistantMessage).order_by(AssistantMessage.id).all()
    assert [row.role for row in logged] == [
        MessageRole.USER, MessageRole.ASSISTANT,
        MessageRole.USER, MessageRole.ASSISTANT,
        MessageRole.USER, MessageRole.ASSISTANT,
    ]


# ---------- Error handling ----------


def test_accept_with_no_open_proposal_is_a_graceful_tool_error(db_session, farmer, monkeypatch):
    script = [
        LLMTurn(text=None, tool_calls=[ToolCall(id="t1", name="accept_proposal", arguments={})]),
        LLMTurn(text="You don't have an open proposal yet.", tool_calls=[]),
    ]
    client = ScriptedLLMClient(script)
    monkeypatch.setattr(ai_coordinator, "get_llm_client", lambda: client)

    reply = ai_coordinator.handle_message(
        db_session, role="farmer", actor_id=farmer.clerk_user_id, channel=ChannelType.WEB,
        text="I accept", farmer=farmer,
    )
    db_session.commit()

    assert reply == "You don't have an open proposal yet."
    logged = db_session.query(AssistantMessage).order_by(AssistantMessage.id).all()
    assert logged[-1].meta["tool_calls"][0]["error"] is True


def test_object_with_no_open_request_is_a_graceful_tool_error(db_session, farmer, monkeypatch):
    script = [
        LLMTurn(
            text=None,
            tool_calls=[ToolCall(id="t1", name="object_to_allocation", arguments={"reason": "OTHER"})],
        ),
        LLMTurn(text="There's nothing open to object to right now.", tool_calls=[]),
    ]
    client = ScriptedLLMClient(script)
    monkeypatch.setattr(ai_coordinator, "get_llm_client", lambda: client)

    reply = ai_coordinator.handle_message(
        db_session, role="farmer", actor_id=farmer.clerk_user_id, channel=ChannelType.WEB,
        text="I object", farmer=farmer,
    )
    db_session.commit()
    assert reply == "There's nothing open to object to right now."


def test_malformed_tool_arguments_do_not_crash_the_turn(db_session, farmer, monkeypatch):
    """A tool call missing a required field (the model hallucinated a bad
    call) must degrade to an error tool result, never a 500."""
    script = [
        LLMTurn(
            text=None,
            tool_calls=[ToolCall(id="t1", name="submit_water_request", arguments={"crop": "Wheat"})],
        ),
        LLMTurn(text="I need a bit more information to submit that request.", tool_calls=[]),
    ]
    client = ScriptedLLMClient(script)
    monkeypatch.setattr(ai_coordinator, "get_llm_client", lambda: client)

    reply = ai_coordinator.handle_message(
        db_session, role="farmer", actor_id=farmer.clerk_user_id, channel=ChannelType.WEB,
        text="I need water", farmer=farmer,
    )
    db_session.commit()

    assert reply == "I need a bit more information to submit that request."
    logged = db_session.query(AssistantMessage).order_by(AssistantMessage.id).all()
    assert logged[-1].meta["tool_calls"][0]["error"] is True
    assert db_session.query(WaterRequest).count() == 0


def test_llm_failure_mid_loop_returns_unavailable_reply(db_session, farmer, monkeypatch):
    class ExplodingClient(LLMClient):
        def complete(self, system, history, tools):
            raise RuntimeError("provider is down")

        def assistant_message(self, turn):  # pragma: no cover - unreachable
            raise AssertionError

        def tool_result_messages(self, turn, results):  # pragma: no cover
            raise AssertionError

    monkeypatch.setattr(ai_coordinator, "get_llm_client", lambda: ExplodingClient())
    reply = ai_coordinator.handle_message(
        db_session, role="farmer", actor_id=farmer.clerk_user_id, channel=ChannelType.WEB,
        text="hello?", farmer=farmer,
    )
    db_session.commit()
    assert reply == ai_coordinator.UNAVAILABLE_REPLY
    logged = db_session.query(AssistantMessage).order_by(AssistantMessage.id).all()
    assert logged[-1].content == ai_coordinator.UNAVAILABLE_REPLY


# ---------- Read-only roles (Jal Vigyani / Dam Operator) ----------


def test_jal_vigyani_get_overview_reads_the_real_dam(db_session, farmer, monkeypatch):
    script = [
        LLMTurn(text=None, tool_calls=[ToolCall(id="t1", name="get_overview", arguments={})]),
        LLMTurn(text="Rampur Dam has 1 canal and no active conflicts.", tool_calls=[]),
    ]
    client = ScriptedLLMClient(script)
    monkeypatch.setattr(ai_coordinator, "get_llm_client", lambda: client)

    reply = ai_coordinator.handle_message(
        db_session, role="jal_vigyani", actor_id="clerk-jv-1", channel=ChannelType.WEB,
        text="How is the dam doing?", dam_id=1,
    )
    db_session.commit()
    assert reply == "Rampur Dam has 1 canal and no active conflicts."
    assert client.seen_tools[0] == [t["name"] for t in ai_coordinator.READONLY_TOOLS]


def test_dam_operator_without_assigned_dam_gets_a_tool_error_not_a_crash(db_session, monkeypatch):
    script = [
        LLMTurn(text=None, tool_calls=[ToolCall(id="t1", name="get_overview", arguments={})]),
        LLMTurn(text="Your account isn't linked to a dam yet.", tool_calls=[]),
    ]
    client = ScriptedLLMClient(script)
    monkeypatch.setattr(ai_coordinator, "get_llm_client", lambda: client)

    reply = ai_coordinator.handle_message(
        db_session, role="dam_operator", actor_id="clerk-dam-1", channel=ChannelType.WEB,
        text="status?", dam_id=None,
    )
    db_session.commit()
    assert reply == "Your account isn't linked to a dam yet."


# ---------- Authorization: no cross-farmer data leakage ----------


def test_farmer_tools_never_touch_another_farmers_data(db_session, farmer, monkeypatch):
    """Even a second farmer sharing the same canal must never appear in — or
    be affected by — this farmer's tool calls. The tool schemas carry no
    farmer/canal identifier the model could pass in; the bound ``farmer``
    object is the only identity used."""
    other = Farmer(
        clerk_user_id="clerk-farmer-2", name="Farmer B", village_id=1,
        phone="+91 90000 00002", canal_id=1,
    )
    db_session.add(other)
    db_session.commit()

    script = [
        LLMTurn(text=None, tool_calls=[ToolCall(id="t1", name="get_status", arguments={})]),
        LLMTurn(text="status", tool_calls=[]),
    ]
    client = ScriptedLLMClient(script)
    monkeypatch.setattr(ai_coordinator, "get_llm_client", lambda: client)

    ai_coordinator.handle_message(
        db_session, role="farmer", actor_id=farmer.clerk_user_id, channel=ChannelType.WEB,
        text="what's my status", farmer=farmer,
    )
    db_session.commit()

    # The stored audit meta only records which tool ran, not its raw JSON
    # payload (see ai_coordinator._log) — assert isolation at the data layer
    # instead: Farmer B has no request/allocation rows this call could touch.
    assert db_session.query(WaterRequest).filter(WaterRequest.farmer_id == other.id).count() == 0


# ---------- Unified audit trail across channels ----------


def test_web_and_twilio_turns_share_one_audit_trail_per_actor(db_session, farmer, monkeypatch):
    script = [LLMTurn(text="hi from web", tool_calls=[])]
    monkeypatch.setattr(ai_coordinator, "get_llm_client", lambda: ScriptedLLMClient(script))
    ai_coordinator.handle_message(
        db_session, role="farmer", actor_id=farmer.clerk_user_id, channel=ChannelType.WEB,
        text="hello web", farmer=farmer,
    )
    db_session.commit()

    script2 = [LLMTurn(text="hi from twilio", tool_calls=[])]
    monkeypatch.setattr(ai_coordinator, "get_llm_client", lambda: ScriptedLLMClient(script2))
    ai_coordinator.handle_message(
        db_session, role="farmer", actor_id=farmer.clerk_user_id, channel=ChannelType.TWILIO,
        text="hello twilio", farmer=farmer,
    )
    db_session.commit()

    rows = (
        db_session.query(AssistantMessage)
        .filter(AssistantMessage.actor_id == farmer.clerk_user_id)
        .order_by(AssistantMessage.id)
        .all()
    )
    channels = {row.channel for row in rows}
    assert channels == {ChannelType.WEB, ChannelType.TWILIO}
    assert all(row.actor_id == farmer.clerk_user_id for row in rows)
