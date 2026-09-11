"""Read-only access to the caller's assigned dam.

dam_operator/jal_vigyani carry dam_id directly (Clerk publicMetadata); this
is the one place that resolves it to the dam's full state, including
village_id — there is no separate village_id mapping for these roles, it's
reached through the dam (see app/core/auth.py).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import AuthUser, require_dam_operator, require_roles, ROLE_DAM_OPERATOR, ROLE_JAL_VIGYANI
from app.db.session import get_db
from app.models.enums import ActorType
from app.models.network import Dam
from app.schemas.network import DamRead, DamSupplyUpdate
from app.services.mediation import audit

router = APIRouter(prefix="/dam", tags=["dam"])

require_dam_scoped_role = require_roles(ROLE_DAM_OPERATOR, ROLE_JAL_VIGYANI)


@router.get("", response_model=DamRead)
def read_assigned_dam(
    user: AuthUser = Depends(require_dam_scoped_role), db: Session = Depends(get_db)
) -> Dam:
    """The signed-in dam_operator/jal_vigyani's assigned dam.

    404 if their Clerk account has no dam_id set, or it doesn't match a
    real dam — both mean the account isn't configured yet (see
    docs/setup.md's Clerk metadata instructions).
    """
    if user.dam_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No dam assigned — set publicMetadata.dam_id in Clerk",
        )
    dam = db.get(Dam, user.dam_id)
    if dam is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dam not found")
    return dam


@router.patch("", response_model=DamRead)
def publish_supply_state(
    payload: DamSupplyUpdate,
    user: AuthUser = Depends(require_dam_operator),
    db: Session = Depends(get_db),
) -> Dam:
    """Publish supply-side state: storage, flows, level, rainfall.

    Dam operators only — this is their core role in the workflow
    (PS14: "How much water do we have?"). Every provided field is
    updated and the change is audit-logged.
    """
    if user.dam_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No dam assigned — set publicMetadata.dam_id in Clerk",
        )
    dam = db.get(Dam, user.dam_id)
    if dam is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dam not found")
    changes: dict[str, object] = {}
    for field_name in (
        "total_available",
        "current_storage",
        "inflow",
        "outflow",
        "water_level",
        "rainfall_last_24h",
        "rainfall_forecast",
    ):
        value = getattr(payload, field_name)
        if value is not None:
            old = getattr(dam, field_name)
            setattr(dam, field_name, value)
            changes[field_name] = {"from": str(old), "to": str(value)}
    if changes:
        audit(
            db,
            "dam.supply_updated",
            "dam",
            str(dam.id),
            actor_type=ActorType.DAM_OPERATOR,
            actor_id=user.user_id,
            details=changes,
        )
    db.commit()
    db.refresh(dam)
    return dam
