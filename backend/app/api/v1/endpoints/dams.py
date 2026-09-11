"""Read-only access to the caller's assigned dam.

dam_operator/jal_vigyani carry dam_id directly (Clerk publicMetadata); this
is the one place that resolves it to the dam's full state, including
village_id — there is no separate village_id mapping for these roles, it's
reached through the dam (see app/core/auth.py).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import AuthUser, require_roles, ROLE_DAM_OPERATOR, ROLE_JAL_VIGYANI
from app.db.session import get_db
from app.models.network import Dam
from app.schemas.network import DamRead

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
