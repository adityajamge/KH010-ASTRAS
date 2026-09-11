"""AI Coordinator — the agentic orchestrator behind every chat surface.

docs/PS14_Water_Sharing_Mediation_Agent.md §12.1 / §26 / §29: the LLM
interprets the farmer's message, decides which deterministic tool to call,
and writes the farmer-facing reply — it never computes an allocation,
schedule, or evidence line itself. Every number in a reply traces back to a
tool result, which in turn comes from app.services.mediation /
app.services.requests, the same deterministic engine the dashboards use.

``handle_message`` is the single entry point for both channels described in
the "AI Chat + Twilio" requirement: the website chat endpoint
(app/api/v1/endpoints/assistant.py) and the Twilio webhook
(app/api/v1/endpoints/twilio_webhook.py) both call this function with the
same tools, same database, same workflow — only ``channel`` differs, and
only for logging/conversation-threading purposes.
"""

from __future__ import annotations

import json
import logging
from datetime import date

from sqlalchemy.orm import Session

from app.api.v1.endpoints import dashboard as dashboard_endpoints
from app.api.v1.endpoints import jal_vigyani as jal_vigyani_endpoints
from app.core.auth import AuthUser
from app.models.assistant import AssistantMessage
from app.models.enums import ActorType, ChannelType, MessageRole, ObjectionReason, PriorityLevel
from app.models.farmer import Farmer
from app.services import mediation as mediation_service
from app.services import requests as requests_service
from app.services.llm_client import LLMNotConfigured, get_llm_client

logger = logging.getLogger(__name__)

NOT_CONFIGURED_REPLY = (
    "The JalSetu assistant isn't connected yet — an administrator needs to set "
    "an LLM API key on the backend. In the meantime, please use the dashboard "
    "directly for your water status, requests, and objections."
)
UNAVAILABLE_REPLY = (
    "Sorry, I couldn't reach the assistant just now. Please try again in a "
    "moment, or use the dashboard directly."
)

MAX_TOOL_ITERATIONS = 4
#: Prior turns (final replies only, not tool calls) replayed for context.
HISTORY_TURNS = 12

FARMER_SYSTEM_PROMPT = """You are the JalSetu AI Coordinator: a neutral digital mediator for irrigation water-sharing disputes between farmers on a shared canal.

You are talking to a farmer over {channel}. Rules:
- Never invent litres, allocations, schedules, or evidence. Every number you state must come from a tool result from THIS conversation — call get_status before answering any question about water, allocation, schedule, or "why did it change".
- To request water, call submit_water_request. To object, ask for a revision, reject a proposal, or report a shortage/leak/problem, call object_to_allocation with whichever reason fits best. To agree to the current proposal, call accept_proposal.
- For a reported problem you cannot verify from the water data (e.g. a physical leak), say the Jal Vigyani may need to inspect it in person, in addition to filing the objection.
- Never claim to control irrigation infrastructure physically, and never claim to replace the Jal Vigyani or guarantee a dispute is resolved — you propose evidence-based allocations; a human can still review them.
- Keep replies short (3-6 sentences), plain, non-technical. Reply in the same language the farmer wrote in.
- If a tool reports an error (e.g. no canal assigned, no open proposal), explain that plainly and say what to do next (e.g. finish onboarding on the website)."""

READONLY_SYSTEM_PROMPT = """You are the JalSetu AI Coordinator, talking to a {role_label} over {channel}. Your one tool, get_overview, returns the live status of their assigned dam and canals. Always call it before answering a question about supply, conflicts, or anomalies — never invent numbers. Keep replies short and plain. This chat cannot change allocations or conflict decisions; point the user to the dashboard for those actions."""

FARMER_TOOLS: list[dict] = [
    {
        "name": "get_status",
        "description": (
            "Get the farmer's current water status: available canal water, "
            "current allocation with its reason/evidence, delivery progress, "
            "upcoming schedule slots, and recent notifications. Call this "
            "before answering any question about water, allocation, "
            "schedule, or shortage."
        ),
        "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "submit_water_request",
        "description": "Submit a new water requirement for the farmer and get a proposal back.",
        "parameters": {
            "type": "object",
            "properties": {
                "quantity_requested": {"type": "number", "description": "Units requested, > 0"},
                "request_date": {
                    "type": "string",
                    "description": "ISO date YYYY-MM-DD; use today if the farmer didn't say",
                },
                "preferred_time": {
                    "type": "string",
                    "description": "Free-form preferred time, e.g. 'morning' or '06:00'",
                },
                "duration_hours": {"type": "number", "description": "Expected irrigation duration in hours"},
                "crop": {"type": "string", "description": "Crop being irrigated"},
                "urgency": {"type": "string", "enum": ["normal", "high", "critical"]},
            },
            "required": [
                "quantity_requested",
                "request_date",
                "preferred_time",
                "duration_hours",
                "crop",
            ],
            "additionalProperties": False,
        },
    },
    {
        "name": "object_to_allocation",
        "description": (
            "File a formal objection to the current allocation proposal and get a "
            "recalculated — or evidence-backed unchanged — proposal back. Use for "
            "objections, rejections, or shortage/problem reports."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "reason": {
                    "type": "string",
                    "enum": [r.value for r in ObjectionReason],
                },
                "details": {
                    "type": "string",
                    "description": "The farmer's own words explaining the objection",
                },
            },
            "required": ["reason"],
            "additionalProperties": False,
        },
    },
    {
        "name": "accept_proposal",
        "description": (
            "Accept the farmer's current allocation proposal, freezing it into a "
            "versioned agreement. Use only when the farmer clearly agrees."
        ),
        "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
    },
]

READONLY_TOOLS: list[dict] = [
    {
        "name": "get_overview",
        "description": (
            "Live overview of the signed-in operator's assigned dam: storage, "
            "canals, farmer count, active conflicts, and active anomalies."
        ),
        "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
    }
]

_ACTOR_TYPE_BY_ROLE = {
    "farmer": ActorType.FARMER,
    "jal_vigyani": ActorType.JAL_VIGYANI,
    "dam_operator": ActorType.DAM_OPERATOR,
}


def handle_message(
    db: Session,
    *,
    role: str,
    actor_id: str,
    channel: ChannelType,
    text: str,
    farmer: Farmer | None = None,
    dam_id: int | None = None,
) -> str:
    """Run one chat turn and return the assistant's reply text.

    ``actor_id`` is always a Clerk user id, even over Twilio — the webhook
    resolves the inbound phone number to a farmer profile before calling
    this function, so the conversation log reads identically either way.
    """
    text = text.strip()
    if not text:
        return "Please send a message describing what you need."

    if role == "farmer":
        if farmer is None:
            raise ValueError("farmer is required when role='farmer'")
        system = FARMER_SYSTEM_PROMPT.format(channel=channel.value)
        tools = FARMER_TOOLS
        auth_user = AuthUser(user_id=actor_id, role="farmer")

        def execute(name: str, args: dict) -> tuple[str, bool]:
            return _execute_farmer_tool(db, farmer, auth_user, name, args)

    elif role in ("jal_vigyani", "dam_operator"):
        role_label = "Jal Vigyani" if role == "jal_vigyani" else "Dam Operator"
        system = READONLY_SYSTEM_PROMPT.format(role_label=role_label, channel=channel.value)
        tools = READONLY_TOOLS
        auth_user = AuthUser(user_id=actor_id, role=role, dam_id=dam_id)

        def execute(name: str, args: dict) -> tuple[str, bool]:
            return _execute_readonly_tool(db, role, auth_user, name, args)

    else:
        raise ValueError(f"Unsupported role: {role}")

    # Fetch prior turns before logging this one, so the just-logged message
    # isn't replayed twice (once from history, once appended below).
    history = _recent_history(db, actor_id, channel)
    _log(db, role, actor_id, channel, MessageRole.USER, text)

    try:
        client = get_llm_client()
    except LLMNotConfigured:
        _log(db, role, actor_id, channel, MessageRole.ASSISTANT, NOT_CONFIGURED_REPLY)
        return NOT_CONFIGURED_REPLY

    history.append({"role": "user", "content": text})
    transcript: list[dict] = []

    try:
        turn = None
        for _ in range(MAX_TOOL_ITERATIONS):
            turn = client.complete(system, history, tools)
            history.append(client.assistant_message(turn))
            if not turn.tool_calls:
                break
            results: list[tuple[str, str, bool]] = []
            for call in turn.tool_calls:
                content, is_error = execute(call.name, call.arguments)
                results.append((call.id, content, is_error))
                transcript.append({"tool": call.name, "args": call.arguments, "error": is_error})
            history.extend(client.tool_result_messages(turn, results))
        reply_text = (turn.text if turn else None) or (
            "I've gone through several steps on this — please check your dashboard "
            "for the latest status, or ask me again more specifically."
        )
    except Exception:  # noqa: BLE001 — a provider/network failure must not 500 the chat
        logger.exception("AI Coordinator turn failed (role=%s, channel=%s)", role, channel.value)
        reply_text = UNAVAILABLE_REPLY
        transcript = []

    _log(
        db,
        role,
        actor_id,
        channel,
        MessageRole.ASSISTANT,
        reply_text,
        meta={"tool_calls": transcript} if transcript else None,
    )
    return reply_text


def _log(
    db: Session,
    role: str,
    actor_id: str,
    channel: ChannelType,
    msg_role: MessageRole,
    content: str,
    meta: dict | None = None,
) -> None:
    db.add(
        AssistantMessage(
            actor_type=_ACTOR_TYPE_BY_ROLE.get(role, ActorType.FARMER),
            actor_id=actor_id,
            channel=channel,
            role=msg_role,
            content=content,
            meta=meta,
        )
    )
    db.flush()


def _recent_history(db: Session, actor_id: str, channel: ChannelType) -> list[dict]:
    """Prior final replies only — intermediate tool turns aren't replayed, so
    history stays a plain, provider-portable list of {role, content} pairs."""
    rows = (
        db.query(AssistantMessage)
        .filter(AssistantMessage.actor_id == actor_id, AssistantMessage.channel == channel)
        .order_by(AssistantMessage.id.desc())
        .limit(HISTORY_TURNS)
        .all()
    )
    rows.reverse()
    return [{"role": r.role.value, "content": r.content} for r in rows]


def _farmer_status(db: Session, farmer: Farmer) -> dict:
    user = AuthUser(user_id=farmer.clerk_user_id, role="farmer")
    summary = dashboard_endpoints.farmer_summary(user=user, db=db).model_dump(mode="json")
    summary["mediation_evidence"] = mediation_service.mediation_view(db, farmer)
    return summary


def _execute_farmer_tool(
    db: Session, farmer: Farmer, user: AuthUser, name: str, args: dict
) -> tuple[str, bool]:
    try:
        if name == "get_status":
            return json.dumps(_farmer_status(db, farmer)), False

        if name == "submit_water_request":
            req = requests_service.submit_water_request(
                db,
                farmer,
                quantity_requested=float(args["quantity_requested"]),
                request_date=date.fromisoformat(args["request_date"]),
                preferred_time=str(args["preferred_time"]),
                duration_hours=float(args["duration_hours"]),
                crop=str(args["crop"]),
                urgency=PriorityLevel(args.get("urgency", "normal")),
                actor_id=user.user_id,
            )
            result = {
                "request_id": req.id,
                "status": req.status.value,
                "mediation": mediation_service.mediation_view(db, farmer),
            }
            return json.dumps(result), False

        if name == "object_to_allocation":
            result = mediation_service.record_objection(
                db, farmer, user, ObjectionReason(args["reason"]), args.get("details")
            )
            return json.dumps(result), False

        if name == "accept_proposal":
            agreement = mediation_service.accept_proposal(db, farmer, user)
            return (
                json.dumps(
                    {
                        "agreement_code": agreement.agreement_code,
                        "version": agreement.version,
                        "final_allocation": agreement.final_allocation,
                        "reason": agreement.reason,
                    }
                ),
                False,
            )

        return f"Unknown tool: {name}", True
    except ValueError as exc:
        return str(exc), True
    except Exception as exc:  # noqa: BLE001 — surfaced to the LLM, not a 500
        logger.exception("Farmer tool %s failed", name)
        return f"Internal error: {exc}", True


def _execute_readonly_tool(
    db: Session, role: str, user: AuthUser, name: str, args: dict
) -> tuple[str, bool]:
    try:
        if name != "get_overview":
            return f"Unknown tool: {name}", True
        if user.dam_id is None:
            return "Account is not assigned to a dam.", True
        if role == "jal_vigyani":
            data = jal_vigyani_endpoints.get_overview(dam_id=user.dam_id, db=db).model_dump(
                mode="json"
            )
        else:
            data = dashboard_endpoints.dam_summary(user=user, db=db).model_dump(mode="json")
        return json.dumps(data), False
    except Exception as exc:  # noqa: BLE001 — surfaced to the LLM, not a 500
        logger.exception("Readonly tool %s failed", name)
        return f"Internal error: {exc}", True
