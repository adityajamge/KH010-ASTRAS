"""JalSetu assistant chat — a small LangGraph graph (one node: call the
model) wrapping ChatAnthropic. No server-side conversation memory: the
client resends the turns it wants Claude to see on every request. (A memory
framework, e.g. mem0 or Supermemory, is an intentional later addition, not
built here.)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.graph.state import CompiledStateGraph

from app.core.auth import ROLE_DAM_OPERATOR, ROLE_FARMER, ROLE_JAL_VIGYANI, AuthUser, require_any_role
from app.core.config import settings
from app.schemas.assistant import ChatRequest, ChatResponse

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

_SYSTEM_PROMPT = (
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


def _build_graph(system_prompt: str) -> CompiledStateGraph:
    model = ChatAnthropic(
        model="claude-haiku-4-5-20251001",
        api_key=settings.ANTHROPIC_API_KEY,
        max_tokens=2048,
    )

    async def call_model(state: MessagesState) -> dict:
        response = await model.ainvoke([SystemMessage(content=system_prompt), *state["messages"]])
        return {"messages": [response]}

    graph = StateGraph(MessagesState)
    graph.add_node("call_model", call_model)
    graph.add_edge(START, "call_model")
    graph.add_edge("call_model", END)
    return graph.compile()


@router.post("/chat", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    user: AuthUser = Depends(require_any_role),
) -> ChatResponse:
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Assistant not configured: set ANTHROPIC_API_KEY in backend .env",
        )

    system_prompt = _SYSTEM_PROMPT.format(
        role=_ROLE_LABEL.get(user.role, "a JalSetu user"),
        language=_LANGUAGE_NAME.get(payload.lang, "English"),
    )
    app = _build_graph(system_prompt)

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
