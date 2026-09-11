"""JalSetu assistant chat — a LangGraph ReAct agent (langgraph.prebuilt.
create_react_agent) wrapping ChatAnthropic. No server-side conversation
memory: the client resends the turns it wants Claude to see on every
request. (A memory framework, e.g. mem0 or Supermemory, is an intentional
later addition, not built here.)

Every role now has real tools bound to its own data — see
app/services/farmer_agent_tools.py, app/services/jal_vigyani_agent_tools.py,
and app/services/dam_operator_agent_tools.py — so the agent can read live
dashboard/conflict/supply state and take real actions instead of just
talking about the app.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langgraph.graph.state import CompiledStateGraph
from langgraph.prebuilt import create_react_agent
from sqlalchemy.orm import Session

from app.core.auth import ROLE_DAM_OPERATOR, ROLE_FARMER, ROLE_JAL_VIGYANI, AuthUser, require_any_role
from app.core.config import settings
from app.db.session import get_db
from app.schemas.assistant import ChatRequest, ChatResponse
from app.services.dam_operator_agent_tools import build_dam_operator_tools
from app.services.farmer_agent_tools import build_farmer_tools
from app.services.jal_vigyani_agent_tools import build_jal_vigyani_tools

router = APIRouter(prefix="/assistant", tags=["assistant"])

_ROLE_LABEL = {
    ROLE_FARMER: "a farmer",
    ROLE_JAL_VIGYANI: "a Jal Vigyani (canal authority / water scientist)",
    ROLE_DAM_OPERATOR: "a dam operator",
}

_LANGUAGE_NAME = {
    "en": "English",
    "hi": "Hindi",
    "mr": "Marathi",
}

_GENERIC_SYSTEM_PROMPT = (
    "You are the JalSetu assistant, embedded in an irrigation water-sharing "
    "platform. The signed-in user is {role}. Help them understand water "
    "allocation, schedules, conflicts, and how the platform's mediation "
    "process works. Be concise and clear. Always reply in {language} — the "
    "user has selected {language} as the app's display language, so answer "
    "in {language} even if they type their message in a different language. "
    "You cannot look up this user's live account data — if they ask about "
    "their specific allocation or schedule, point them to the relevant "
    "dashboard section rather than guessing numbers."
)

_FARMER_SYSTEM_PROMPT = (
    "You are the JalSetu assistant for farmers. You have tools to read this "
    "farmer's real, live account data and to take real actions for them: "
    "submit a water request, file an objection to a proposal, and accept a "
    "proposal. Call get_dashboard_summary or get_mediation_status whenever "
    "the farmer asks about their water, allocation, schedule, or current "
    "proposal — never guess a number, always look it up first. Before "
    "calling submit_water_request, submit_objection, or "
    "accept_current_proposal, make sure every required detail is known and "
    "the farmer has clearly asked for that action — ask a clarifying "
    "question instead of guessing a value or assuming consent, especially "
    "before accept_current_proposal, which cannot be silently undone. After "
    "a tool call, explain the result in plain language, never as raw JSON. "
    "Be concise. Always reply in {language} — the user has selected "
    "{language} as the app's display language, so answer in {language} "
    "even if they type their message in a different language."
)

_JAL_VIGYANI_SYSTEM_PROMPT = (
    "You are the JalSetu assistant for a Jal Vigyani (canal authority / "
    "water scientist). You have tools to read this account's real, live "
    "dam-wide data — canals, farmer allocations, under-delivery cases, "
    "schedules, and conflicts — and to take real actions: assign a farmer "
    "to a canal, and record a decision (approve / request revision / "
    "escalate) on a conflict. Call the relevant get_/list_ tool whenever "
    "asked about the dam, a canal, a farmer, a delivery, or a conflict — "
    "never guess a number, always look it up first. Look up "
    "list_assignable_farmers_tool or list_conflicts_tool first if you need "
    "a farmer_id, canal_id, or conflict_id you don't already have. Before "
    "calling assign_farmer_canal or decide_conflict, make sure every "
    "required detail is known and the Jal Vigyani has clearly asked for "
    "that action — ask a clarifying question instead of guessing which "
    "farmer, canal, conflict, or decision they mean. After a tool call, "
    "explain the result in plain language, never as raw JSON. Be concise. "
    "Always reply in {language} — the user has selected {language} as the "
    "app's display language, so answer in {language} even if they type "
    "their message in a different language."
)

_DAM_OPERATOR_SYSTEM_PROMPT = (
    "You are the JalSetu assistant for a dam operator. You have tools to "
    "read this account's real, live dam data — reservoir/storage stats, "
    "canal releases, rainfall, and the water accounting flow chain — and to "
    "publish updated supply-side numbers (storage, inflow, outflow, water "
    "level, rainfall). Call get_dam_dashboard for status questions, and "
    "get_dam_details first if you need the dam's exact current numeric "
    "values (e.g. to compute a new total from a change the operator "
    "describes). Only call publish_supply_state once the operator has "
    "given you a specific, confirmed new value for each field you're "
    "about to change — never guess or estimate a number yourself, and pass "
    "only the fields that actually changed. This update immediately "
    "affects every downstream allocation calculation, so ask a clarifying "
    "question rather than assume. After a tool call, explain the result in "
    "plain language, never as raw JSON. Be concise. Always reply in "
    "{language} — the user has selected {language} as the app's display "
    "language, so answer in {language} even if they type their message in "
    "a different language."
)


def _extract_text(message: BaseMessage) -> str:
    """ChatAnthropic returns `content` as a plain string, or — when the
    model includes thinking/other blocks — a list of content-block dicts.
    Handle both so a thinking-capable model never yields an empty reply."""
    content = message.content
    if isinstance(content, str):
        return content
    parts = []
    for block in content:
        if isinstance(block, dict) and block.get("type") == "text":
            parts.append(block.get("text", ""))
        elif isinstance(block, str):
            parts.append(block)
    return "".join(parts)


def _build_graph(system_prompt: str, tools: list) -> CompiledStateGraph:
    model = ChatAnthropic(
        model="claude-haiku-4-5-20251001",
        api_key=settings.ANTHROPIC_API_KEY,
        max_tokens=2048,
    )
    return create_react_agent(model, tools, prompt=system_prompt)


@router.post("/chat", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    user: AuthUser = Depends(require_any_role),
    db: Session = Depends(get_db),
) -> ChatResponse:
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Assistant not configured: set ANTHROPIC_API_KEY in backend .env",
        )

    language = _LANGUAGE_NAME.get(payload.lang, "English")
    if user.role == ROLE_FARMER:
        tools = build_farmer_tools(db, user, payload.lang)
        system_prompt = _FARMER_SYSTEM_PROMPT.format(language=language)
    elif user.role == ROLE_JAL_VIGYANI:
        tools = build_jal_vigyani_tools(db, user, payload.lang)
        system_prompt = _JAL_VIGYANI_SYSTEM_PROMPT.format(language=language)
    elif user.role == ROLE_DAM_OPERATOR:
        tools = build_dam_operator_tools(db, user, payload.lang)
        system_prompt = _DAM_OPERATOR_SYSTEM_PROMPT.format(language=language)
    else:
        tools = []
        system_prompt = _GENERIC_SYSTEM_PROMPT.format(
            role=_ROLE_LABEL.get(user.role, "a JalSetu user"), language=language
        )
    app = _build_graph(system_prompt, tools)

    history = [
        HumanMessage(content=m.content) if m.role == "user" else AIMessage(content=m.content)
        for m in payload.history
    ]
    messages = [*history, HumanMessage(content=payload.message)]

    try:
        result = await app.ainvoke({"messages": messages})
    except Exception as exc:  # ChatAnthropic surfaces provider errors as various exception types
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not reach the assistant. Please try again.",
        ) from exc

    reply = _extract_text(result["messages"][-1])
    return ChatResponse(reply=reply)
