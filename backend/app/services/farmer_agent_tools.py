"""Tool-calling surface for the farmer chat agent.

Every tool below is a thin wrapper around the existing dashboard/mediation/
request *endpoint* functions — same validation, same commit path, same
allocation numbers. No business logic is duplicated here; this module only
adapts the app's existing Python functions to LangChain's tool-calling
convention, and turns an HTTPException into a plain string the model can
relay to the farmer instead of letting it crash the whole chat turn.
"""

from __future__ import annotations

from datetime import date

from fastapi import HTTPException
from langchain_core.tools import tool
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.api.v1.endpoints.dashboard import farmer_summary
from app.api.v1.endpoints.mediation import (
    accept_current_proposal as _accept_proposal_endpoint,
    read_own_mediation,
    submit_objection as _submit_objection_endpoint,
)
from app.api.v1.endpoints.requests import submit_request as _submit_request_endpoint
from app.core.auth import AuthUser
from app.models.enums import ObjectionReason, PriorityLevel
from app.schemas.dashboard import ObjectionSubmit, WaterRequestSubmit
from app.schemas.request import WaterRequestRead


def build_farmer_tools(db: Session, user: AuthUser, lang: str) -> list:
    """Tools scoped to one signed-in farmer's own data, for one chat turn."""

    @tool
    def get_dashboard_summary() -> str:
        """Get the farmer's live dashboard: canal, available/allocated/remaining
        water, current request and allocation status, upcoming irrigation
        schedule, and recent notifications. Call this whenever the farmer
        asks about their water, allocation, schedule, or general status —
        never guess these numbers."""
        try:
            return farmer_summary(user=user, db=db).model_dump_json()
        except HTTPException as exc:
            db.rollback()
            return f"Error: {exc.detail}"

    @tool
    def get_mediation_status() -> str:
        """Get the farmer's current allocation proposal: requested vs.
        allocated quantity, the reason/evidence behind it, whether there is
        an active shortage conflict, and the valid objection reasons. Call
        this before submitting an objection or accepting a proposal, to see
        the current numbers first."""
        try:
            return read_own_mediation(user=user, db=db).model_dump_json()
        except HTTPException as exc:
            db.rollback()
            return f"Error: {exc.detail}"

    @tool
    def submit_water_request(
        quantity_units: float,
        request_date: str,
        preferred_time: str,
        duration_hours: float,
        crop: str,
        urgency: str = "normal",
    ) -> str:
        """Submit a new water request for the farmer's canal.
        quantity_units: how much water is requested, in units.
        request_date: ISO date (YYYY-MM-DD); must be today or a future date.
        preferred_time: one of "morning", "afternoon", "evening".
        duration_hours: how many hours irrigation should run (0-24).
        crop: the crop this water is for.
        urgency: one of "normal", "high", "critical".
        Returns the resulting allocation proposal. Only call this once you
        have every required detail from the farmer — ask first if something
        is missing or ambiguous, never guess a quantity or date."""
        try:
            payload = WaterRequestSubmit(
                quantity_requested=quantity_units,
                request_date=date.fromisoformat(request_date),
                preferred_time=preferred_time,
                duration_hours=duration_hours,
                crop=crop,
                urgency=PriorityLevel(urgency.lower()),
            )
        except (ValueError, ValidationError) as exc:
            return f"Error: could not submit request — {exc}"
        try:
            req = _submit_request_endpoint(payload=payload, user=user, db=db)
        except HTTPException as exc:
            db.rollback()
            return f"Error: {exc.detail}"
        return WaterRequestRead.model_validate(req).model_dump_json()

    @tool
    def submit_objection(reason: str, details: str | None = None) -> str:
        """File an objection to the farmer's current allocation proposal —
        this reruns the mediation engine with the farmer's priority boosted
        and asks the mediation agent to respond.
        reason must be exactly one of: NEED_MORE_WATER, NEED_DIFFERENT_TIME,
        CROP_CRITICAL, EMERGENCY, OTHER.
        details: optional free text describing the farmer's situation in
        their own words — pass along whatever the farmer told you.
        Returns the revised proposal and the mediation agent's reply."""
        try:
            reason_enum = ObjectionReason(reason.upper())
        except ValueError:
            return (
                "Error: reason must be one of NEED_MORE_WATER, "
                "NEED_DIFFERENT_TIME, CROP_CRITICAL, EMERGENCY, OTHER."
            )
        payload = ObjectionSubmit(reason=reason_enum, details=details, lang=lang)
        try:
            result = _submit_objection_endpoint(payload=payload, user=user, db=db)
        except HTTPException as exc:
            db.rollback()
            return f"Error: {exc.detail}"
        return result.model_dump_json()

    @tool
    def accept_current_proposal() -> str:
        """Accept the farmer's current allocation proposal, freezing it into
        a versioned agreement. This cannot be silently undone afterwards —
        only call this after the farmer has clearly confirmed they want to
        accept, never on an assumption."""
        try:
            result = _accept_proposal_endpoint(user=user, db=db)
        except HTTPException as exc:
            db.rollback()
            return f"Error: {exc.detail}"
        return result.model_dump_json()

    return [
        get_dashboard_summary,
        get_mediation_status,
        submit_water_request,
        submit_objection,
        accept_current_proposal,
    ]
