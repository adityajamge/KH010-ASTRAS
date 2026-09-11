from datetime import datetime

from sqlalchemy import ARRAY, DateTime, ForeignKey, JSON, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin
from app.models.enums import AnomalyStatus


class SensorReading(Base):
    __tablename__ = "sensor_readings"

    id: Mapped[int] = mapped_column(primary_key=True)
    canal_id: Mapped[int] = mapped_column(ForeignKey("canals.id", ondelete="CASCADE"))
    location: Mapped[str] = mapped_column(String(80))
    flow: Mapped[float] = mapped_column(Numeric(10, 2))
    water_level: Mapped[float] = mapped_column(Numeric(6, 2))
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Anomaly(Base, TimestampMixin):
    __tablename__ = "anomalies"

    id: Mapped[int] = mapped_column(primary_key=True)
    canal_id: Mapped[int] = mapped_column(ForeignKey("canals.id", ondelete="CASCADE"))
    code: Mapped[str] = mapped_column(String(20), unique=True)
    location: Mapped[str] = mapped_column(String(80))
    expected_value: Mapped[float] = mapped_column(Numeric(10, 2))
    measured_value: Mapped[float] = mapped_column(Numeric(10, 2))
    difference: Mapped[float] = mapped_column(Numeric(10, 2))
    status: Mapped[AnomalyStatus] = mapped_column(
        default=AnomalyStatus.INVESTIGATION_REQUIRED
    )
    # e.g. ["Leakage", "Gate mismatch"] — docs §4.7 possible causes.
    # JSON variant keeps the test suite runnable on SQLite; Postgres keeps ARRAY.
    possible_causes: Mapped[list[str]] = mapped_column(
        ARRAY(String).with_variant(JSON, "sqlite")
    )
