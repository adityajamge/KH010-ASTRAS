from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import AuthUser, require_any_role
from app.db.session import get_db
from app.models.network import Canal
from app.schemas.network import CanalRead

router = APIRouter(prefix="/canals", tags=["canals"])


@router.get("", response_model=list[CanalRead])
def list_canals(
    user: AuthUser = Depends(require_any_role), db: Session = Depends(get_db)
) -> list[Canal]:
    """Canals available for a farmer to select during onboarding."""
    return db.query(Canal).order_by(Canal.name).all()
