from fastapi import APIRouter

from app.core.config import settings
from app.schemas.health import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    """Versioned health-check endpoint: GET /api/v1/health."""
    return HealthResponse(
        status="ok",
        service="jalsetu-api",
        version=settings.PROJECT_VERSION,
        environment=settings.ENVIRONMENT,
    )
