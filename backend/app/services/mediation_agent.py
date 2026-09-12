"""LLM mediation agent — the negotiation "voice" of the mediation workflow.

This is deliberately kept separate from :mod:`app.services.allocation`: the
engine there decides every litre and is the only source of numbers. This
module never computes an allocation — it only turns an already-decided
outcome into a grounded, farmer-facing negotiation reply, addressing the
farmer's specific objection instead of the generic evidence dump the engine
produces on its own. If the LLM is unconfigured or unreachable, callers fall
back to the deterministic ``build_reason`` text; a mediation reply is a nice-
to-have, never a dependency for the workflow to function.
"""

from __future__ import annotations

import asyncio
import logging

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from app.core.config import settings

logger = logging.getLogger(__name__)

_LANGUAGE_NAME = {"en": "English", "hi": "Hindi", "mr": "Marathi"}

_SYSTEM_PROMPT = (
    "You are the JalSetu mediation agent. You facilitate water-sharing "
    "negotiations between farmers on a shared irrigation canal. A separate, "
    "deterministic rule engine has already decided every allocation number "
    "below by fixed fairness rules (priority weights, a 50% minimum fair "
    "share, proportional splitting under shortage, and a hard cap that no "
    "one is ever allocated more than requested) — you never decide, change, "
    "or invent a number yourself. Your job is to write the negotiation "
    "reply: address the farmer's specific objection directly, explain in "
    "plain terms why the allocation is what it is (or why it changed), and "
    "be fair-minded and transparent about the constraints, citing only the "
    "facts given to you. Keep it to 3-5 short sentences. Plain prose only — "
    "no markdown, no bullet points, no headings, no asterisks. Reply "
    "entirely in {language}."
)


def _extract_text(content) -> str:
    if isinstance(content, str):
        return content
    parts = []
    for block in content:
        if isinstance(block, dict) and block.get("type") == "text":
            parts.append(block.get("text", ""))
        elif isinstance(block, str):
            parts.append(block)
    return "".join(parts)


async def _amediate(*, farmer_name: str, canal_name: str, facts: str, lang: str) -> str:
    model = ChatAnthropic(
        model="claude-haiku-4-5-20251001",
        api_key=settings.ANTHROPIC_API_KEY,
        max_tokens=512,
        # Bounded so a slow/unresponsive provider can't stall the
        # synchronous objection-submission request for minutes — this call
        # sits in the critical path of POST /mediation/objections, and a
        # mediation reply is a nice-to-have (see module docstring), never
        # worth blocking the deterministic outcome on. Left unset, the
        # underlying SDK's default is 10 minutes, retried up to twice.
        timeout=15,
        max_retries=1,
    )
    system_prompt = _SYSTEM_PROMPT.format(language=_LANGUAGE_NAME.get(lang, "English"))
    response = await model.ainvoke(
        [SystemMessage(content=system_prompt), HumanMessage(content=facts)]
    )
    return _extract_text(response.content).strip()


def mediate_objection(
    *,
    farmer_name: str,
    canal_name: str,
    reason_label: str,
    details: str | None,
    requested: float,
    previous_allocated: float,
    revised_allocated: float,
    changed: bool,
    urgency: str,
    total_demand: float,
    available_water: float,
    shortage: float,
    evidence: list[str],
    lang: str = "en",
) -> str | None:
    """Return a grounded negotiation reply, or ``None`` if the LLM can't run.

    Synchronous by design: the mediation workflow (``record_objection``) is
    called from sync FastAPI routes running in the threadpool, so a fresh
    event loop via ``asyncio.run`` is safe here and keeps the call site a
    plain function call with a graceful fallback on any failure.
    """
    if not settings.ANTHROPIC_API_KEY:
        return None

    details_suffix = f" (farmer's own words: \"{details}\")" if details else ""
    evidence_lines = "\n".join(f"- {line}" for line in evidence)
    facts = (
        f"Canal: {canal_name}\n"
        f"Farmer: {farmer_name}\n"
        f"Farmer's objection: {reason_label}{details_suffix}\n\n"
        "Current situation:\n"
        f"- Requested: {requested:.2f} units\n"
        f"- Previously proposed allocation: {previous_allocated:.2f} units\n"
        f"- Allocation after this objection: {revised_allocated:.2f} units "
        f"({'changed' if changed else 'unchanged'})\n"
        f"- Farmer's urgency level now: {urgency}\n"
        f"- Total demand on canal: {total_demand:.2f} units\n"
        f"- Available water: {available_water:.2f} units\n"
        f"- Shortage: {shortage:.2f} units\n"
        f"- Engine evidence:\n{evidence_lines}\n\n"
        "Write the mediation reply to this farmer now."
    )

    try:
        return asyncio.run(
            _amediate(farmer_name=farmer_name, canal_name=canal_name, facts=facts, lang=lang)
        )
    except Exception:
        logger.exception("mediation agent call failed")
        return None
