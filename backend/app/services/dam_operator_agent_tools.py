"""Tool-calling surface for the dam operator chat agent.

Same principle as the farmer/Jal Vigyani tool modules: every tool is a thin
wrapper around the existing dam-scoped endpoint functions — same dam_id
resolution, same validation, same audit-logged commit path. No business
logic is duplicated here.

The dam operator's role in PS14 is narrow and specific: publish supply-side
numbers ("how much water do we have") — everything else (allocation,
mediation, canal assignment) belongs to the farmer/Jal Vigyani agents.
"""

from __future__ import annotations

from fastapi import HTTPException
from langchain_core.tools import tool
from sqlalchemy.orm import Session

from app.api.v1.endpoints.dams import (
    publish_supply_state as _publish_supply_state_endpoint,
    read_assigned_dam,
)
from app.api.v1.endpoints.dashboard import dam_summary
from app.core.auth import AuthUser
from app.schemas.network import DamRead, DamSupplyUpdate


def build_dam_operator_tools(db: Session, user: AuthUser, lang: str) -> list:
    """Tools scoped to one signed-in dam operator's own dam, for one chat turn."""

    @tool
    def get_dam_dashboard() -> str:
        """Get the dam-wide dashboard: display-formatted stat cards (storage,
        inflow/outflow, release rate, rainfall, dam status, emergency
        alerts), the per-canal release table, rainfall, and the water
        accounting flow chain. Call this for any "how are things looking"
        or "what's the status" question."""
        try:
            return dam_summary(user=user, db=db).model_dump_json()
        except HTTPException as exc:
            return f"Error: {exc.detail}"

    @tool
    def get_dam_details() -> str:
        """Get the dam's exact current numeric fields (total_available,
        current_storage, inflow, outflow, water_level, rainfall_last_24h,
        rainfall_forecast) — not the formatted display strings from
        get_dam_dashboard. Call this before publish_supply_state so you
        know the precise current values (e.g. to compute a new total from
        a delta the operator gives you)."""
        try:
            dam = read_assigned_dam(user=user, db=db)
        except HTTPException as exc:
            return f"Error: {exc.detail}"
        return DamRead.model_validate(dam).model_dump_json()

    @tool
    def publish_supply_state(
        total_available: float | None = None,
        current_storage: float | None = None,
        inflow: float | None = None,
        outflow: float | None = None,
        water_level: float | None = None,
        rainfall_last_24h: float | None = None,
        rainfall_forecast: str | None = None,
    ) -> str:
        """Publish updated supply-side numbers for this dam — the operator's
        core "how much water do we have" update. Only pass the fields that
        actually changed; leave the rest as null. This is audit-logged and
        immediately affects every downstream allocation calculation, so
        only call it once the operator has given you a specific, confirmed
        new value — never guess or estimate one yourself."""
        try:
            dam = _publish_supply_state_endpoint(
                payload=DamSupplyUpdate(
                    total_available=total_available,
                    current_storage=current_storage,
                    inflow=inflow,
                    outflow=outflow,
                    water_level=water_level,
                    rainfall_last_24h=rainfall_last_24h,
                    rainfall_forecast=rainfall_forecast,
                ),
                user=user,
                db=db,
            )
        except HTTPException as exc:
            db.rollback()
            return f"Error: {exc.detail}"
        return DamRead.model_validate(dam).model_dump_json()

    return [get_dam_dashboard, get_dam_details, publish_supply_state]
