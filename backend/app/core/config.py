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
    # https://localhost / http://localhost / capacitor://localhost are the
    # Capacitor Android/iOS WebView origins (frontend/capacitor.config.ts —
    # androidScheme is "http" for now, since the backend has no TLS cert;
    # https://localhost is kept too in case that ever changes back) — the
    # native app shares this same backend.
    BACKEND_CORS_ORIGINS: Annotated[list[str], NoDecode] = [
        "http://localhost:5173",
        "https://localhost",
        "http://localhost",
        "capacitor://localhost",
    ]

    # Neon Postgres (https://console.neon.tech). Use the direct (non-pooled)
    # connection string — this app is a long-lived server, not a
    # per-request serverless function, so it keeps its own small pool and
    # doesn't need PgBouncer. Empty = DB-backed endpoints are unavailable.
    DATABASE_URL: str = ""

    # Clerk authentication (https://dashboard.clerk.com).
    # Empty secret = auth endpoints return 503 until configured.
    CLERK_SECRET_KEY: str = ""
    # Authorized parties (frontend origins) accepted in session tokens.
    CLERK_AUTHORIZED_PARTIES: Annotated[list[str], NoDecode] = [
        "http://localhost:5173",
        "https://localhost",
        "http://localhost",
        "capacitor://localhost",
    ]

    # AI Coordinator (docs/PS14_Water_Sharing_Mediation_Agent.md §§12.1, 26, 29).
    # Provider-agnostic: the same tool-calling agent loop runs against either
    # backend (app/services/llm_client.py). Empty key for the selected
    # provider = the assistant replies with a "not configured" notice instead
    # of erroring, on both the website chat and the Twilio channel.
    LLM_PROVIDER: Literal["anthropic", "openai"] = "anthropic"
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-haiku-4-5-20251001"
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"

    # Twilio (https://console.twilio.com) — WhatsApp/SMS prototype channel for
    # the same AI Coordinator the website chat uses (no separate business
    # logic). Empty SID/token = the /twilio/inbound webhook is unavailable.
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    # Sandbox number Twilio assigns, e.g. "whatsapp:+14155238886".
    TWILIO_WHATSAPP_FROM: str = ""
    # Plain E.164 number for the SMS fallback channel, e.g. "+14155238886".
    TWILIO_SMS_FROM: str = ""
    # Skip request-signature verification in local dev (no public HTTPS URL
    # for Twilio to sign against). Leave true in any deployed environment.
    TWILIO_VALIDATE_SIGNATURE: bool = True

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
