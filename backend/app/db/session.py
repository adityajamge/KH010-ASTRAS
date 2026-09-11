"""SQLAlchemy engine, session factory, and the FastAPI DB dependency.

Raises at first use (not at import time) when DATABASE_URL is unset, so the
rest of the app still boots for local frontend-only work.
"""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

_engine = None
_SessionLocal: sessionmaker[Session] | None = None


def _get_engine():
    global _engine, _SessionLocal
    if _engine is None:
        if not settings.DATABASE_URL:
            raise RuntimeError(
                "DATABASE_URL is not configured — set it in backend/.env "
                "(see .env.example) to a Neon connection string."
            )
        _engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
        _SessionLocal = sessionmaker(
            bind=_engine, autoflush=False, autocommit=False, expire_on_commit=False
        )
    return _engine


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency: yields a request-scoped session, closed on teardown."""
    _get_engine()
    assert _SessionLocal is not None
    db = _SessionLocal()
    try:
        yield db
    finally:
        db.close()
