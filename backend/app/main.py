"""FastAPI application factory with CORS and health checks."""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.schemas.health import HealthResponse

# uvicorn only configures its own "uvicorn"/"uvicorn.error"/"uvicorn.access"
# loggers, not the root logger — without this, every logger.exception(...)
# in the app (e.g. app.services.ai_coordinator on an LLM/DB failure) is
# silently swallowed instead of printing to the console.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.PROJECT_VERSION,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix=settings.API_V1_PREFIX)

    @app.get("/", tags=["health"], summary="Service root")
    def root() -> dict[str, str]:
        return {"service": "jalsetu-api", "status": "ok"}

    @app.get("/health", tags=["health"], response_model=HealthResponse, summary="Liveness probe")
    def health() -> HealthResponse:
        return HealthResponse(
            status="ok",
            service="jalsetu-api",
            version=settings.PROJECT_VERSION,
            environment=settings.ENVIRONMENT,
        )

    return app


app = create_app()
