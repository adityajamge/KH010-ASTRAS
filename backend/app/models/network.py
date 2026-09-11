from sqlalchemy import Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class Canal(Base, TimestampMixin):
    __tablename__ = "canals"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True)
    capacity: Mapped[float] = mapped_column(Numeric(10, 2))
    current_flow: Mapped[float] = mapped_column(Numeric(10, 2))
    water_level: Mapped[float] = mapped_column(Numeric(6, 2))


class WaterSource(Base, TimestampMixin):
    """The dam / reservoir supplying the canal network."""

    __tablename__ = "water_sources"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True)
    total_available: Mapped[float] = mapped_column(Numeric(12, 2))
    current_storage: Mapped[float] = mapped_column(Numeric(12, 2))
    inflow: Mapped[float] = mapped_column(Numeric(10, 2))
    outflow: Mapped[float] = mapped_column(Numeric(10, 2))
