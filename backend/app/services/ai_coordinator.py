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

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.api.v1.endpoints import conflicts as conflicts_endpoints
from app.api.v1.endpoints import dams as dams_endpoints
from app.api.v1.endpoints import dashboard as dashboard_endpoints
from app.api.v1.endpoints import jal_vigyani as jal_vigyani_endpoints
from app.core.auth import AuthUser
from app.models.assistant import AssistantMessage
from app.models.enums import ActorType, ChannelType, MessageRole, ObjectionReason, PriorityLevel
from app.models.farmer import Farmer
from app.schemas.conflict import ConflictRead
from app.schemas.jal_vigyani import CanalAssignmentRequest, ConflictDecisionRequest
from app.schemas.network import DamRead, DamSupplyUpdate
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

MAX_TOOL_ITERATIONS = 6
#: Prior turns (final replies only, not tool calls) replayed for context.
HISTORY_TURNS = 12

#: The dashboard's language dropdown (frontend/src/lib/i18n.tsx). When the
#: caller passes one of these, replies follow it regardless of what language
#: the farmer typed in; otherwise the prompt falls back to mirroring the
#: farmer's own language.
LANGUAGE_NAME = {"en": "English", "hi": "Hindi", "mr": "Marathi"}

FARMER_SYSTEM_PROMPT = """You are the JalSetu AI Coordinator: a neutral digital mediator for irrigation water-sharing disputes between farmers on a shared canal.

You are talking with {farmer_name}, a farmer, over {channel}. You already know their name — it's given above; never say you don't have access to it or send them to the website to look it up. Rules:
- Never invent litres, allocations, schedules, or evidence. Every number you state must come from a tool result from THIS conversation — call get_status before answering any question about water, allocation, schedule, or "why did it change".
- To request water, call submit_water_request. To object, ask for a revision, reject a proposal, or report a shortage/leak/problem, call object_to_allocation with whichever reason fits best. To agree to the current proposal, call accept_proposal.
- For a reported problem you cannot verify from the water data (e.g. a physical leak), say the Jal Vigyani may need to inspect it in person, in addition to filing the objection.
- Never claim to control irrigation infrastructure physically, and never claim to replace the Jal Vigyani or guarantee a dispute is resolved — you propose evidence-based allocations; a human can still review them.
- Keep replies short (3-6 sentences), plain, non-technical. {language_instruction}
- If a tool reports an error (e.g. no canal assigned, no open proposal), explain that plainly and say what to do next (e.g. finish onboarding on the website)."""

JAL_VIGYANI_SYSTEM_PROMPT = """You are the JalSetu AI Coordinator, talking to a Jal Vigyani (canal authority / water scientist) over {channel}.

Rules:
- Never invent numbers. Call the relevant get_/list_ tool before answering any question about the dam, a canal, a farmer, a delivery, or a conflict.
- Call list_assignable_farmers or list_conflicts first if you need a farmer_id, canal_id, or conflict_id you don't already have — never guess one.
- To assign or unassign a farmer's canal, call assign_farmer_canal. To record a decision on a conflict (approve / request revision / escalate), call decide_conflict — only once the Jal Vigyani has clearly said which conflict and which decision; ask a clarifying question rather than guess.
- Keep replies short (3-6 sentences), plain, non-technical. {language_instruction}
- If a tool reports an error, explain that plainly and say what to do next."""

DAM_OPERATOR_SYSTEM_PROMPT = """You are the JalSetu AI Coordinator, talking to a dam operator over {channel}.

Rules:
- Never invent numbers. Call get_overview for a formatted status summary (storage, releases, rainfall, flow accounting), or get_dam_details first if you need the dam's exact current numeric values — e.g. to compute a new total from a change the operator describes.
- Only call publish_supply_state once the operator has given you a specific, confirmed new value for each field you're about to change — never guess or estimate a number yourself, and pass only the fields that actually changed. This update immediately affects every downstream allocation calculation, so ask a clarifying question rather than assume.
- Keep replies short (3-6 sentences), plain, non-technical. {language_instruction}
- If a tool reports an error, explain that plainly and say what to do next."""


def _language_instruction(lang: str | None) -> str:
    if lang and lang in LANGUAGE_NAME:
        name = LANGUAGE_NAME[lang]
        return f"Always reply in {name} — the user has selected {name} as the app's display language, even if they type in a different language."
    return "Reply in the same language the farmer wrote in."

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

JAL_VIGYANI_TOOLS: list[dict] = [
    {
        "name": "get_overview",
        "description": (
            "Live overview of this dam: storage, canals, farmer count, "
            "active conflicts, and active anomalies."
        ),
        "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "list_farmer_allocations",
        "description": (
            "Every farmer's most recent request/allocation/delivery status "
            "on this dam's canals, including any shortfall."
        ),
        "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "list_under_delivery_cases",
        "description": (
            "Deliveries currently short of their allocation or flagged for "
            "investigation, across this dam's canals."
        ),
        "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "get_canal_schedule",
        "description": (
            "Every farmer's scheduled irrigation time slot across this "
            "dam's canals — date, start/end time, quantity, status."
        ),
        "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "list_assignable_farmers",
        "description": (
            "Farmers who can be assigned a canal on this dam: anyone still "
            "unassigned, plus anyone already on one of this dam's canals."
        ),
        "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "assign_farmer_canal",
        "description": (
            "Assign a farmer to a canal on this dam, or unassign them by "
            "omitting canal_id. The canal must belong to this dam."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "farmer_id": {"type": "integer"},
                "canal_id": {
                    "type": "integer",
                    "description": "Omit this field entirely to unassign the farmer's canal.",
                },
            },
            "required": ["farmer_id"],
            "additionalProperties": False,
        },
    },
    {
        "name": "list_conflicts",
        "description": "Every water-shortage conflict on this dam's canals, newest first.",
        "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "get_conflict_detail",
        "description": (
            "Full detail on one conflict: participants and every objection "
            "filed against it, including the mediation agent's reply to "
            "each farmer."
        ),
        "parameters": {
            "type": "object",
            "properties": {"conflict_id": {"type": "integer"}},
            "required": ["conflict_id"],
            "additionalProperties": False,
        },
    },
    {
        "name": "decide_conflict",
        "description": (
            "Record a decision on a conflict. This only logs the decision "
            "to the audit trail — it does not itself change any allocation."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "conflict_id": {"type": "integer"},
                "action": {
                    "type": "string",
                    "enum": ["approve", "request_revision", "escalate"],
                },
                "note": {"type": "string", "description": "Optional free-text reason"},
            },
            "required": ["conflict_id", "action"],
            "additionalProperties": False,
        },
    },
]

DAM_OPERATOR_TOOLS: list[dict] = [
    {
        "name": "get_overview",
        "description": (
            "Formatted dam-wide status: stat cards (storage, inflow/"
            "outflow, release rate, rainfall, dam status, emergency "
            "alerts), per-canal release table, rainfall, and the water "
            "accounting flow chain."
        ),
        "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "get_dam_details",
        "description": (
            "The dam's exact current numeric fields (total_available, "
            "current_storage, inflow, outflow, water_level, "
            "rainfall_last_24h, rainfall_forecast) — not the formatted "
            "display strings from get_overview."
        ),
        "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "publish_supply_state",
        "description": (
            "Publish updated supply-side numbers for this dam. Only pass "
            "the fields that actually changed."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "total_available": {"type": "number"},
                "current_storage": {"type": "number"},
                "inflow": {"type": "number"},
                "outflow": {"type": "number"},
                "water_level": {"type": "number"},
                "rainfall_last_24h": {"type": "number"},
                "rainfall_forecast": {"type": "string"},
            },
            "additionalProperties": False,
        },
    },
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
    lang: str | None = None,
) -> str:
    """Run one chat turn and return the assistant's reply text.

    ``actor_id`` is always a Clerk user id, even over Twilio — the webhook
    resolves the inbound phone number to a farmer profile before calling
    this function, so the conversation log reads identically either way.
    ``lang`` is the dashboard's language dropdown ("en"/"hi"/"mr"); leave it
    unset (e.g. over Twilio, which has no such dropdown) to have the model
    mirror whatever language the message itself is written in.
    """
    text = text.strip()
    if not text:
        return "Please send a message describing what you need."
    language_instruction = _language_instruction(lang)

    if role == "farmer":
        if farmer is None:
            raise ValueError("farmer is required when role='farmer'")
        system = FARMER_SYSTEM_PROMPT.format(
            farmer_name=farmer.name,
            channel=channel.value,
            language_instruction=language_instruction,
        )
        tools = FARMER_TOOLS
        auth_user = AuthUser(user_id=actor_id, role="farmer")

        def execute(name: str, args: dict) -> tuple[str, bool]:
            return _execute_farmer_tool(db, farmer, auth_user, name, args, lang=lang or "en")

    elif role == "jal_vigyani":
        system = JAL_VIGYANI_SYSTEM_PROMPT.format(
            channel=channel.value, language_instruction=language_instruction
        )
        tools = JAL_VIGYANI_TOOLS
        auth_user = AuthUser(user_id=actor_id, role=role, dam_id=dam_id)

        def execute(name: str, args: dict) -> tuple[str, bool]:
            return _execute_jal_vigyani_tool(db, auth_user, name, args)

    elif role == "dam_operator":
        system = DAM_OPERATOR_SYSTEM_PROMPT.format(
            channel=channel.value, language_instruction=language_instruction
        )
        tools = DAM_OPERATOR_TOOLS
        auth_user = AuthUser(user_id=actor_id, role=role, dam_id=dam_id)

        def execute(name: str, args: dict) -> tuple[str, bool]:
            return _execute_dam_operator_tool(db, auth_user, name, args)

    else:
        raise ValueError(f"Unsupported role: {role}")

    # Fetch prior turns before logging this one, so the just-logged message
    # isn't replayed twice (once from history, once appended below).
    # Scoped by role too, not just actor_id+channel: if a Clerk account's
    # role is ever changed (e.g. a farmer promoted to Jal Vigyani, or a
    # test account's role edited), a prior conversation held under the old
    # role must never be replayed as context into the new one.
    history = _recent_history(db, actor_id, channel, _ACTOR_TYPE_BY_ROLE.get(role, ActorType.FARMER))
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


def _recent_history(
    db: Session, actor_id: str, channel: ChannelType, actor_type: ActorType
) -> list[dict]:
    """Prior final replies only — intermediate tool turns aren't replayed, so
    history stays a plain, provider-portable list of {role, content} pairs.
    Scoped by actor_type as well as actor_id: a role change must not let a
    farmer's future turns see what was said back when the same Clerk
    account was a Jal Vigyani or dam operator, or vice versa."""
    rows = (
        db.query(AssistantMessage)
        .filter(
            AssistantMessage.actor_id == actor_id,
            AssistantMessage.channel == channel,
            AssistantMessage.actor_type == actor_type,
        )
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
    db: Session, farmer: Farmer, user: AuthUser, name: str, args: dict, lang: str = "en"
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
                db, farmer, user, ObjectionReason(args["reason"]), args.get("details"), lang
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


def _execute_jal_vigyani_tool(
    db: Session, user: AuthUser, name: str, args: dict
) -> tuple[str, bool]:
    if user.dam_id is None:
        return "Account is not assigned to a dam.", True
    dam_id = user.dam_id
    try:
        if name == "get_overview":
            data = jal_vigyani_endpoints.get_overview(dam_id=dam_id, db=db).model_dump(mode="json")
            return json.dumps(data), False

        if name == "list_farmer_allocations":
            rows = jal_vigyani_endpoints.get_farmer_allocations(dam_id=dam_id, db=db)
            return json.dumps([r.model_dump(mode="json") for r in rows]), False

        if name == "list_under_delivery_cases":
            rows = jal_vigyani_endpoints.get_under_delivery(dam_id=dam_id, db=db)
            return json.dumps([r.model_dump(mode="json") for r in rows]), False

        if name == "get_canal_schedule":
            rows = jal_vigyani_endpoints.get_canal_schedule(dam_id=dam_id, db=db)
            return json.dumps([r.model_dump(mode="json") for r in rows]), False

        if name == "list_assignable_farmers":
            rows = jal_vigyani_endpoints.list_assignable_farmers(dam_id=dam_id, db=db)
            return json.dumps([r.model_dump(mode="json") for r in rows]), False

        if name == "assign_farmer_canal":
            result = jal_vigyani_endpoints.assign_farmer_canal(
                farmer_id=int(args["farmer_id"]),
                payload=CanalAssignmentRequest(canal_id=args.get("canal_id")),
                dam_id=dam_id,
                db=db,
            )
            return json.dumps(result.model_dump(mode="json")), False

        if name == "list_conflicts":
            rows = conflicts_endpoints.list_conflicts(dam_id=dam_id, db=db)
            data = [ConflictRead.model_validate(r).model_dump(mode="json") for r in rows]
            return json.dumps(data), False

        if name == "get_conflict_detail":
            result = conflicts_endpoints.get_conflict(
                conflict_id=int(args["conflict_id"]), dam_id=dam_id, db=db
            )
            return json.dumps(result.model_dump(mode="json")), False

        if name == "decide_conflict":
            action = str(args["action"])
            if action not in ("approve", "request_revision", "escalate"):
                return "action must be one of approve, request_revision, escalate.", True
            result = conflicts_endpoints.decide_conflict(
                conflict_id=int(args["conflict_id"]),
                payload=ConflictDecisionRequest(action=action, note=args.get("note")),
                dam_id=dam_id,
                user=user,
                db=db,
            )
            return json.dumps(ConflictRead.model_validate(result).model_dump(mode="json")), False

        return f"Unknown tool: {name}", True
    except HTTPException as exc:
        return str(exc.detail), True
    except Exception as exc:  # noqa: BLE001 — surfaced to the LLM, not a 500
        logger.exception("Jal Vigyani tool %s failed", name)
        return f"Internal error: {exc}", True


def _execute_dam_operator_tool(
    db: Session, user: AuthUser, name: str, args: dict
) -> tuple[str, bool]:
    if user.dam_id is None:
        return "Account is not assigned to a dam.", True
    try:
        if name == "get_overview":
            data = dashboard_endpoints.dam_summary(user=user, db=db).model_dump(mode="json")
            return json.dumps(data), False

        if name == "get_dam_details":
            dam = dams_endpoints.read_assigned_dam(user=user, db=db)
            return json.dumps(DamRead.model_validate(dam).model_dump(mode="json")), False

        if name == "publish_supply_state":
            payload = DamSupplyUpdate(
                total_available=args.get("total_available"),
                current_storage=args.get("current_storage"),
                inflow=args.get("inflow"),
                outflow=args.get("outflow"),
                water_level=args.get("water_level"),
                rainfall_last_24h=args.get("rainfall_last_24h"),
                rainfall_forecast=args.get("rainfall_forecast"),
            )
            dam = dams_endpoints.publish_supply_state(payload=payload, user=user, db=db)
            return json.dumps(DamRead.model_validate(dam).model_dump(mode="json")), False

        return f"Unknown tool: {name}", True
    except HTTPException as exc:
        return str(exc.detail), True
    except Exception as exc:  # noqa: BLE001 — surfaced to the LLM, not a 500
        logger.exception("Dam operator tool %s failed", name)
        return f"Internal error: {exc}", True
