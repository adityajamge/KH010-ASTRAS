from fastapi import APIRouter, Depends

from app.core.auth import AuthUser, require_any_role
from app.schemas.auth import MeResponse

router = APIRouter(tags=["auth"])


@router.get("/me", response_model=MeResponse)
def read_me(user: AuthUser = Depends(require_any_role)) -> MeResponse:
    """Return the authenticated user's id, role, and assigned dam (if any). Requires any known role."""
    return MeResponse(user_id=user.user_id, role=user.role, dam_id=user.dam_id)
