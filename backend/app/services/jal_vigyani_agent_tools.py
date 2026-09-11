"""Tool-calling surface for the Jal Vigyani (canal authority) chat agent.

Same principle as app/services/farmer_agent_tools.py: every tool is a thin
wrapper around the existing dam-scoped endpoint functions — same dam_id
scoping, same validation, same commit path. No business logic is
duplicated here; this module only adapts those functions to LangChain's
tool-calling convention and turns an HTTPException into a plain string the
model can relay instead of letting it crash the chat turn.
"""

from __future__ import annotations

import json

from fastapi import HTTPException
from langchain_core.tools import tool
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.v1.endpoints.conflicts import (
    decide_conflict as _decide_conflict_endpoint,
    get_conflict as _get_conflict_endpoint,
    list_conflicts as _list_conflicts_endpoint,
)
from app.api.v1.endpoints.jal_vigyani import (
    assign_farmer_canal as _assign_farmer_canal_endpoint,
    get_canal_schedule,
    get_farmer_allocations,
    get_overview,
    get_under_delivery,
    list_assignable_farmers,
)
from app.core.auth import AuthUser, require_jal_vigyani_dam_id
from app.schemas.conflict import ConflictRead
from app.schemas.jal_vigyani import CanalAssignmentRequest, ConflictDecisionRequest


def _dump(items: list[BaseModel]) -> str:
    return json.dumps([item.model_dump(mode="json") for item in items])


def build_jal_vigyani_tools(db: Session, user: AuthUser, lang: str) -> list:
    """Tools scoped to one signed-in Jal Vigyani's own dam, for one chat turn.

    Raises HTTPException (403) if the account has no dam assigned — same
    check every Jal Vigyani dashboard endpoint already makes, so the caller
    sees the same error it would from any other Jal Vigyani API call.
    """
    dam_id = require_jal_vigyani_dam_id(user=user)

    @tool
    def get_dam_overview() -> str:
        """Get the dam-wide overview: dam details, every canal on this dam,
        farmer count, and counts of active conflicts/anomalies/under-delivery
        cases. Call this first for any "how are things looking" question."""
        return get_overview(dam_id=dam_id, db=db).model_dump_json()

    @tool
    def list_farmer_allocations() -> str:
        """Get every farmer's most recent request/allocation/delivery status
        on this dam's canals, including any shortfall. Use this to answer
        questions about a specific farmer's allocation or to find farmers
        who are under-delivered."""
        return _dump(get_farmer_allocations(dam_id=dam_id, db=db))

    @tool
    def list_under_delivery_cases() -> str:
        """Get deliveries currently short of their allocation or flagged for
        investigation, across this dam's canals."""
        return _dump(get_under_delivery(dam_id=dam_id, db=db))

    @tool
    def get_canal_schedule_tool() -> str:
        """Get every farmer's scheduled irrigation time slot across this
        dam's canals — date, start/end time, quantity, and status."""
        return _dump(get_canal_schedule(dam_id=dam_id, db=db))

    @tool
    def list_assignable_farmers_tool() -> str:
        """List farmers who can be assigned a canal on this dam: anyone
        still unassigned, plus anyone already on one of this dam's canals.
        Call this before assign_farmer_canal to find the right farmer_id
        and confirm which canal_id belongs to this dam."""
        return _dump(list_assignable_farmers(dam_id=dam_id, db=db))

    @tool
    def assign_farmer_canal(farmer_id: int, canal_id: int | None) -> str:
        """Assign a farmer to a canal on this dam, or unassign them by
        passing canal_id=null. The canal must belong to this dam. Only call
        this once the Jal Vigyani has clearly said which farmer and which
        canal — ask first if either is ambiguous."""
        try:
            result = _assign_farmer_canal_endpoint(
                farmer_id=farmer_id,
                payload=CanalAssignmentRequest(canal_id=canal_id),
                dam_id=dam_id,
                db=db,
            )
        except HTTPException as exc:
            db.rollback()
            return f"Error: {exc.detail}"
        return result.model_dump_json()

    @tool
    def list_conflicts_tool() -> str:
        """List every water-shortage conflict on this dam's canals, newest
        first — code, canal, status, demand/available/shortage, and the
        engine's proposal. Call this before reviewing or deciding a specific
        conflict, to find its conflict_id."""
        rows = _list_conflicts_endpoint(dam_id=dam_id, db=db)
        return _dump([ConflictRead.model_validate(r) for r in rows])

    @tool
    def get_conflict_detail(conflict_id: int) -> str:
        """Get full detail on one conflict: participants and every objection
        filed against it, including the mediation agent's reply to each
        farmer. Call this before deciding a conflict."""
        try:
            return _get_conflict_endpoint(
                conflict_id=conflict_id, dam_id=dam_id, db=db
            ).model_dump_json()
        except HTTPException as exc:
            return f"Error: {exc.detail}"

    @tool
    def decide_conflict(conflict_id: int, action: str, note: str | None = None) -> str:
        """Record a decision on a conflict: action must be exactly one of
        "approve", "request_revision", or "escalate". note is an optional
        free-text reason. This only logs the decision to the audit trail —
        it does not itself change any allocation. Only call this once the
        Jal Vigyani has clearly stated which conflict and which decision."""
        if action not in ("approve", "request_revision", "escalate"):
            return (
                "Error: action must be one of approve, request_revision, escalate."
            )
        try:
            result = _decide_conflict_endpoint(
                conflict_id=conflict_id,
                payload=ConflictDecisionRequest(action=action, note=note),
                dam_id=dam_id,
                user=user,
                db=db,
            )
        except HTTPException as exc:
            db.rollback()
            return f"Error: {exc.detail}"
        return ConflictRead.model_validate(result).model_dump_json()

    return [
        get_dam_overview,
        list_farmer_allocations,
        list_under_delivery_cases,
        get_canal_schedule_tool,
        list_assignable_farmers_tool,
        assign_farmer_canal,
        list_conflicts_tool,
        get_conflict_detail,
        decide_conflict,
    ]
