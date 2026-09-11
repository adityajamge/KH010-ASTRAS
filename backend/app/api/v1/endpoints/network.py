"""3D digital twin state — GET /api/v1/network/state.

Feeds the Three.js/React Three Fiber scene (frontend/src/components/twin).
Every number here is composed from the existing dashboard/jal-vigyani/
conflict/monitoring services (app/services/network_state.py); this endpoint
adds no new business logic, only authorization and dam-id resolution.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from sqlalchemy.orm import Session

from app.core.auth import AuthUser, require_any_role
from app.db.session import get_db
from app.schemas.network_state import NetworkStateResponse
from app.services import network_state as network_state_service
from app.services.farmers import get_own_farmer

router = APIRouter(prefix="/network", tags=["network"])


@router.get("/state", response_model=NetworkStateResponse)
def get_network_state(
    user: AuthUser = Depends(require_any_role), db: Session = Depends(get_db)
) -> NetworkStateResponse:
    farmer = get_own_farmer(db, user) if user.role == "farmer" else None
    try:
        state = network_state_service.build_network_state(db, user, farmer)
    except network_state_service.DamNotResolved as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc))
    return NetworkStateResponse(**state)
