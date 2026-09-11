"""Conflict management for Jal Vigyani.

docs/Dashboards/PS14_Dashboard_Feature_Specification.md §4.6 — actions are
Review (no-op, just viewing the detail below), Approve, Request Revision,
and Escalate. A decision records a status transition + audit log entry;
it does not itself run the allocation/mediation engine — that's a separate
deterministic component (docs/PS14_Water_Sharing_Mediation_Agent.md §12.3).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import AuthUser, require_jal_vigyani, require_jal_vigyani_dam_id
from app.db.session import get_db
from app.models.conflict import Conflict, ConflictParticipant, Objection
from app.models.enums import ActorType, ConflictStatus
from app.models.farmer import Farmer
from app.models.network import Canal
from app.models.system import AuditLog
from app.schemas.conflict import ConflictRead
from app.schemas.jal_vigyani import (
    ConflictDecisionRequest,
    ConflictDetail,
    ConflictParticipantDetail,
    ObjectionDetail,
)

router = APIRouter(prefix="/conflicts", tags=["conflicts"])

_DECISION_STATUS = {
    "approve": ConflictStatus.APPROVED,
    "request_revision": ConflictStatus.REVISION_REQUESTED,
    "escalate": ConflictStatus.ESCALATED,
}


def _dam_canal_ids(db: Session, dam_id: int) -> list[int]:
    return [row[0] for row in db.query(Canal.id).filter(Canal.dam_id == dam_id).all()]


def _get_dam_conflict(db: Session, dam_id: int, conflict_id: int) -> Conflict:
    conflict = (
        db.query(Conflict)
        .filter(Conflict.id == conflict_id, Conflict.canal_id.in_(_dam_canal_ids(db, dam_id)))
        .first()
    )
    if conflict is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Conflict not found")
    return conflict


@router.get("", response_model=list[ConflictRead])
def list_conflicts(
    dam_id: int = Depends(require_jal_vigyani_dam_id), db: Session = Depends(get_db)
) -> list[Conflict]:
    canal_ids = _dam_canal_ids(db, dam_id)
    if not canal_ids:
        return []
    return (
        db.query(Conflict)
        .filter(Conflict.canal_id.in_(canal_ids))
        .order_by(Conflict.created_at.desc())
        .all()
    )


@router.get("/{conflict_id}", response_model=ConflictDetail)
def get_conflict(
    conflict_id: int,
    dam_id: int = Depends(require_jal_vigyani_dam_id),
    db: Session = Depends(get_db),
) -> ConflictDetail:
    """§4.6 — full detail behind the "Review" action: participants + objections."""
    conflict = _get_dam_conflict(db, dam_id, conflict_id)

    participants = (
        db.query(ConflictParticipant, Farmer)
        .join(Farmer, ConflictParticipant.farmer_id == Farmer.id)
        .filter(ConflictParticipant.conflict_id == conflict.id)
        .all()
    )
    objections = (
        db.query(Objection, Farmer)
        .join(Farmer, Objection.farmer_id == Farmer.id)
        .filter(Objection.conflict_id == conflict.id)
        .order_by(Objection.created_at.desc())
        .all()
    )

    return ConflictDetail(
        id=conflict.id,
        conflict_code=conflict.conflict_code,
        canal_id=conflict.canal_id,
        status=conflict.status,
        total_demand=float(conflict.total_demand),
        available_water=float(conflict.available_water),
        shortage=float(conflict.shortage),
        priority=conflict.priority,
        proposal=conflict.proposal,
        participants=[
            ConflictParticipantDetail(
                farmer_id=farmer.id, farmer_name=farmer.name, request_id=cp.request_id
            )
            for cp, farmer in participants
        ],
        objections=[
            ObjectionDetail(
                id=o.id,
                farmer_id=farmer.id,
                farmer_name=farmer.name,
                reason=o.reason,
                details=o.details,
                status=o.status,
            )
            for o, farmer in objections
        ],
    )


@router.post("/{conflict_id}/decision", response_model=ConflictRead)
def decide_conflict(
    conflict_id: int,
    payload: ConflictDecisionRequest,
    dam_id: int = Depends(require_jal_vigyani_dam_id),
    user: AuthUser = Depends(require_jal_vigyani),
    db: Session = Depends(get_db),
) -> Conflict:
    """Approve / request revision / escalate — logged to the audit trail."""
    conflict = _get_dam_conflict(db, dam_id, conflict_id)
    old_status = conflict.status
    conflict.status = _DECISION_STATUS[payload.action]

    db.add(
        AuditLog(
            actor_type=ActorType.JAL_VIGYANI,
            actor_id=user.user_id,
            action=f"conflict.{payload.action}",
            entity_type="conflict",
            entity_id=str(conflict.id),
            details={
                "old_status": old_status.value,
                "new_status": conflict.status.value,
                "note": payload.note,
            },
        )
    )
    db.commit()
    db.refresh(conflict)
    return conflict
