"""Clerk session verification and role-based guards.

Roles (farmer, jal_vigyani, dam_operator) live in Clerk ``publicMetadata.role``.
dam_operator and jal_vigyani accounts also carry ``publicMetadata.dam_id`` —
the shared dam (see app/models/network.py Dam) they're assigned to. For this
hackathon every such account is assigned dam_id=1 (see docs/setup.md). The
session token only proves identity, so both are read from the Clerk Backend
API (short TTL cache) — no custom JWT template needed.
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

_IDENTITY_CACHE_TTL_SECONDS = 60
_identity_cache: dict[str, tuple[str | None, int | None, float]] = {}


@dataclass
class AuthUser:
    user_id: str
    role: str | None
    # Assigned dam (dam_operator / jal_vigyani only) — None for farmers and
    # for accounts without publicMetadata.dam_id set.
    dam_id: int | None = None


def _clerk_client() -> Clerk:
    if not settings.CLERK_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Auth not configured: set CLERK_SECRET_KEY in backend .env",
        )
    return Clerk(bearer_auth=settings.CLERK_SECRET_KEY)


def _cached_identity(clerk: Clerk, user_id: str) -> tuple[str | None, int | None]:
    now = time.monotonic()
    cached = _identity_cache.get(user_id)
    if cached and now - cached[2] < _IDENTITY_CACHE_TTL_SECONDS:
        return cached[0], cached[1]
    user = clerk.users.get(user_id=user_id)
    metadata = user.public_metadata or {}
    role = metadata.get("role")
    role = role if isinstance(role, str) else None
    dam_id = metadata.get("dam_id")
    dam_id = dam_id if isinstance(dam_id, int) else None
    _identity_cache[user_id] = (role, dam_id, now)
    return role, dam_id


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
    role, dam_id = _cached_identity(clerk, user_id)
    return AuthUser(user_id=user_id, role=role, dam_id=dam_id)


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


def require_jal_vigyani_dam_id(user: AuthUser = Depends(require_jal_vigyani)) -> int:
    """Jal Vigyani dashboard endpoints are scoped to the account's assigned dam."""
    if user.dam_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is not assigned to a dam (missing publicMetadata.dam_id)",
        )
    return user.dam_id
