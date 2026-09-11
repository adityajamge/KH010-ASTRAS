from functools import lru_cache
from typing import Annotated, Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables / .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    PROJECT_NAME: str = "JalSetu API"
    PROJECT_VERSION: str = "0.1.0"
    ENVIRONMENT: Literal["development", "production", "test"] = "development"

    HOST: str = "0.0.0.0"
    PORT: int = 8000
    API_V1_PREFIX: str = "/api/v1"

    # Comma-separated string in .env, e.g. "http://localhost:5173,http://localhost:3000"
    # NoDecode: these are plain comma-separated strings, not JSON arrays —
    # pydantic-settings otherwise tries to JSON-decode any list[str] field
    # read from .env before the field_validator below ever runs.
    BACKEND_CORS_ORIGINS: Annotated[list[str], NoDecode] = ["http://localhost:5173"]

    # Neon Postgres (https://console.neon.tech). Use the direct (non-pooled)
    # connection string — this app is a long-lived server, not a
    # per-request serverless function, so it keeps its own small pool and
    # doesn't need PgBouncer. Empty = DB-backed endpoints are unavailable.
    DATABASE_URL: str = ""

    # Clerk authentication (https://dashboard.clerk.com).
    # Empty secret = auth endpoints return 503 until configured.
    CLERK_SECRET_KEY: str = ""
    # Authorized parties (frontend origins) accepted in session tokens.
    CLERK_AUTHORIZED_PARTIES: Annotated[list[str], NoDecode] = ["http://localhost:5173"]

    # Anthropic API (https://console.anthropic.com). Empty = assistant chat
    # endpoint returns 503 until configured.
    ANTHROPIC_API_KEY: str = ""

    @field_validator("BACKEND_CORS_ORIGINS", "CLERK_AUTHORIZED_PARTIES", mode="before")
    @classmethod
    def split_comma_separated(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
