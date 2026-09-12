"""Digital-twin state aggregator (docs/PS14_Water_Sharing_Mediation_Agent.md
§§7-10 "3D Digital Twin").

This module computes nothing new — it composes the exact same read services
the dashboards already use (dam_summary, get_farmer_allocations,
list_conflicts) into one shape for the 3D scene. The deterministic backend
stays the single source of truth; the twin only visualizes it.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.api.v1.endpoints import conflicts as conflicts_endpoints
from app.api.v1.endpoints import dashboard as dashboard_endpoints
from app.api.v1.endpoints import jal_vigyani as jal_vigyani_endpoints
from app.api.v1.endpoints import monitoring as monitoring_endpoints
from app.core.auth import AuthUser
from app.models.conflict import Conflict, ConflictParticipant, Objection
from app.models.enums import AnomalyStatus, ConflictStatus, ObjectionStatus
from app.models.farmer import Farmer
from app.models.network import Canal, Dam
from app.services.allocation import dam_status, flow_state, release_status

SIMULATION_NOTE = (
    "JalSetu prototype: dam, canal and farmer values are a synthetic "
    "demonstration dataset, not live sensor telemetry (see docs/"
    "PS14_Water_Sharing_Mediation_Agent.md §22)."
)


class DamNotResolved(ValueError):
    """No dam could be determined for this account (e.g. farmer has no
    canal assigned yet, or an operator account has no dam_id metadata)."""


def resolve_dam_id(db: Session, user: AuthUser, farmer: Farmer | None) -> int:
    if user.role == "farmer":
        if farmer is None or farmer.canal_id is None:
            raise DamNotResolved(
                "No canal assigned yet — finish onboarding to see the network view"
            )
        canal = db.get(Canal, farmer.canal_id)
        if canal is None:
            raise DamNotResolved("Assigned canal not found")
        return canal.dam_id
    if user.dam_id is None:
        raise DamNotResolved("Account is not assigned to a dam")
    return user.dam_id


def _twin_status(
    row_status: str,
    requested: float | None,
    allocated: float | None,
    has_conflict: bool,
    has_pending_objection: bool,
) -> str:
    """Deterministic classification for the twin's color/marker — derived
    only from real request/allocation/delivery numbers and conflict/
    objection rows, never from the AI Coordinator or an LLM."""
    if has_conflict:
        return "conflict"
    if has_pending_objection:
        return "pending_mediation"
    if row_status in ("under_delivery", "investigation_required"):
        return "delivery_issue"
    if row_status == "no_request":
        return "normal"
    if requested is not None and allocated is not None and allocated < requested - 0.01:
        return "shortage"
    if row_status in (
        "accepted",
        "scheduled",
        "in_progress",
        "completed",
        "over_delivery",
        "on_track",
        "complete",
    ):
        return "approved"
    return "normal"


def _position_label(index: int, total: int) -> str:
    if total <= 1:
        return "head"
    third = max(1, total // 3)
    if index < third:
        return "head"
    if index >= total - third:
        return "tail"
    return "middle"


def build_network_state(db: Session, user: AuthUser, farmer: Farmer | None) -> dict:
    dam_id = resolve_dam_id(db, user, farmer)
    dam = db.get(Dam, dam_id)
    if dam is None:
        raise DamNotResolved("Dam not found")

    # Reuse the dam dashboard's exact computation for reservoir stats and
    # per-canal release accounting — no separate business logic here.
    dam_view = dashboard_endpoints.dam_summary(
        user=AuthUser(user_id="network-state", role="dam_operator", dam_id=dam_id), db=db
    )
    farmer_rows = {
        row.farmer_id: row
        for row in jal_vigyani_endpoints.get_farmer_allocations(dam_id=dam_id, db=db)
    }
    conflict_rows = conflicts_endpoints.list_conflicts(dam_id=dam_id, db=db)
    anomaly_rows = monitoring_endpoints.list_anomalies(dam_id=dam_id, db=db)

    canals = db.query(Canal).filter(Canal.dam_id == dam_id).order_by(Canal.name).all()
    release_by_name = {r.canal: r for r in dam_view.releases}

    open_conflicts_by_canal: dict[int, list[Conflict]] = {}
    for c in conflict_rows:
        if c.status != ConflictStatus.RESOLVED:
            open_conflicts_by_canal.setdefault(c.canal_id, []).append(c)

    open_conflict_ids = [c.id for c in conflict_rows if c.status != ConflictStatus.RESOLVED]
    conflict_participant_farmer_ids: set[int] = set()
    if open_conflict_ids:
        conflict_participant_farmer_ids = {
            row[0]
            for row in db.query(ConflictParticipant.farmer_id)
            .filter(ConflictParticipant.conflict_id.in_(open_conflict_ids))
            .all()
        }

    pending_objection_farmer_ids: set[int] = set()
    if open_conflict_ids:
        pending_objection_farmer_ids = {
            row[0]
            for row in db.query(Objection.farmer_id)
            .filter(
                Objection.conflict_id.in_(open_conflict_ids),
                Objection.status == ObjectionStatus.PENDING,
            )
            .all()
        }

    open_anomalies_by_canal: dict[int, int] = {}
    for a in anomaly_rows:
        if a.status not in (AnomalyStatus.RESOLVED, AnomalyStatus.DISMISSED):
            open_anomalies_by_canal[a.canal_id] = open_anomalies_by_canal.get(a.canal_id, 0) + 1

    canal_states = []
    for canal in canals:
        canal_farmers = (
            db.query(Farmer)
            .filter(Farmer.canal_id == canal.id)
            .order_by(Farmer.id)
            .all()
        )
        total = len(canal_farmers)
        twin_farmers = []
        for index, f in enumerate(canal_farmers):
            row = farmer_rows.get(f.id)
            row_status = row.status if row else "no_request"
            requested = row.requested if row else None
            allocated = row.allocated if row else None
            delivered = row.delivered if row else None
            shortfall = row.shortfall if row else None
            has_conflict = f.id in conflict_participant_farmer_ids
            has_pending_objection = f.id in pending_objection_farmer_ids
            twin_farmers.append(
                {
                    "farmer_id": f.id,
                    "name": f.name,
                    "canal_id": canal.id,
                    "order_index": index,
                    "position_label": _position_label(index, total),
                    "requested": requested,
                    "allocated": allocated,
                    "delivered": delivered,
                    "shortfall": shortfall,
                    "status": row_status,
                    "has_conflict": has_conflict,
                    "has_pending_objection": has_pending_objection,
                    "twin_status": _twin_status(
                        row_status, requested, allocated, has_conflict, has_pending_objection
                    ),
                }
            )

        release = release_by_name.get(canal.name)
        canal_states.append(
            {
                "canal_id": canal.id,
                "name": canal.name,
                "capacity": float(canal.capacity),
                "current_flow": float(canal.current_flow),
                "water_level": float(canal.water_level),
                "flow_state": flow_state(float(canal.current_flow), float(canal.capacity)),
                "release_status": release.status if release else release_status(0, 0, 0, 0),
                "requested": release.requested if release else 0.0,
                "approved": release.approved if release else 0.0,
                "released": release.released if release else float(canal.current_flow),
                "received": release.received if release else 0.0,
                "difference": release.difference if release else 0.0,
                "active_conflicts": len(open_conflicts_by_canal.get(canal.id, [])),
                "active_anomalies": open_anomalies_by_canal.get(canal.id, 0),
                "farmers": twin_farmers,
            }
        )

    status_label, status_tone = dam_status(float(dam.current_storage), float(dam.total_available))

    return {
        "is_simulated": True,
        "simulation_note": SIMULATION_NOTE,
        "generated_at": datetime.now(timezone.utc),
        "dam": {
            "dam_id": dam.id,
            "name": dam.name,
            "water_level": float(dam.water_level),
            "current_storage": float(dam.current_storage),
            "total_available": float(dam.total_available),
            "inflow": float(dam.inflow),
            "outflow": float(dam.outflow),
            "rainfall_last_24h": float(dam.rainfall_last_24h),
            "status": status_label,
            "status_tone": status_tone,
        },
        "canals": canal_states,
        "total_active_conflicts": len(open_conflict_ids),
        "total_active_anomalies": sum(open_anomalies_by_canal.values()),
    }
