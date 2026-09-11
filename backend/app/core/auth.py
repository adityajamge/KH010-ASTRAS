"""Clerk session verification and role-based guards.

Roles (farmer, jal_vigyani, dam_operator) live in Clerk ``publicMetadata.role``.
The session token only proves identity, so the role is read from the Clerk
Backend API (short TTL cache) — no custom JWT template needed.
"""

import time
from dataclasses import dataclass

from clerk_backend_api import Clerk
from clerk_backend_api.security.types import AuthenticateRequestOptions
from fastapi import Depends, HTTPException, Request, status

from app.core.config import settings

ROLE_FARMER = "farmer"
ROLE_JAL_VIGYANI = "jal_vigyani"
ROLE_DAM_OPERATOR = "dam_operator"
ALL_ROLES = (ROLE_FARMER, ROLE_JAL_VIGYANI, ROLE_DAM_OPERATOR)

_ROLE_CACHE_TTL_SECONDS = 60
_role_cache: dict[str, tuple[str | None, float]] = {}


@dataclass
class AuthUser:
    user_id: str
    role: str | None


def _clerk_client() -> Clerk:
    if not settings.CLERK_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Auth not configured: set CLERK_SECRET_KEY in backend .env",
        )
    return Clerk(bearer_auth=settings.CLERK_SECRET_KEY)


def _cached_role(clerk: Clerk, user_id: str) -> str | None:
    now = time.monotonic()
    cached = _role_cache.get(user_id)
    if cached and now - cached[1] < _ROLE_CACHE_TTL_SECONDS:
        return cached[0]
    user = clerk.users.get(user_id=user_id)
    metadata = user.public_metadata or {}
    role = metadata.get("role")
    role = role if isinstance(role, str) else None
    _role_cache[user_id] = (role, now)
    return role


async def get_current_user(request: Request) -> AuthUser:
    """Verify the Clerk session token; 401 when missing/invalid."""
    clerk = _clerk_client()
    state = clerk.authenticate_request(
        request,
        AuthenticateRequestOptions(
            authorized_parties=settings.CLERK_AUTHORIZED_PARTIES or None
        ),
    )
    if not state.is_signed_in or not state.payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    user_id = state.payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    return AuthUser(user_id=user_id, role=_cached_role(clerk, user_id))


def require_roles(*roles: str):
    """Dependency factory: 401 when signed out, 403 when role is not allowed."""

    async def guard(user: AuthUser = Depends(get_current_user)) -> AuthUser:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient role",
            )
        return user

    return guard


require_any_role = require_roles(*ALL_ROLES)
require_farmer = require_roles(ROLE_FARMER)
require_jal_vigyani = require_roles(ROLE_JAL_VIGYANI)
require_dam_operator = require_roles(ROLE_DAM_OPERATOR)
