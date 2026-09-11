from sqlalchemy import ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class Dam(Base, TimestampMixin):
    """Physical dam infrastructure.

    Predefined/seeded (see alembic/versions — seed_dam migration), never
    created through the app. For the hackathon there is exactly one row,
    id=1 "Rampur Dam", and every canal/farmer/request/etc. operates within
    its shared context. dam_operator and jal_vigyani users are assigned a
    dam_id via Clerk publicMetadata (see app/core/auth.py); the same dam_id
    for both roles in this demo.
    """

    __tablename__ = "dams"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True)
    village_id: Mapped[int] = mapped_column(ForeignKey("villages.id"))
    total_available: Mapped[float] = mapped_column(Numeric(12, 2))
    current_storage: Mapped[float] = mapped_column(Numeric(12, 2))
    inflow: Mapped[float] = mapped_column(Numeric(10, 2))
    outflow: Mapped[float] = mapped_column(Numeric(10, 2))
    # Reservoir level in metres — published by the dam operator.
    water_level: Mapped[float] = mapped_column(Numeric(6, 2), default=118.4)
    # Rainfall over the last 24h in mm + short text forecast.
    rainfall_last_24h: Mapped[float] = mapped_column(Numeric(8, 2), default=18)
    rainfall_forecast: Mapped[str] = mapped_column(
        Text, default="Medium — 12mm expected over next 24h"
    )


class Canal(Base, TimestampMixin):
    __tablename__ = "canals"

    id: Mapped[int] = mapped_column(primary_key=True)
    dam_id: Mapped[int] = mapped_column(ForeignKey("dams.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(80), unique=True)
    capacity: Mapped[float] = mapped_column(Numeric(10, 2))
    current_flow: Mapped[float] = mapped_column(Numeric(10, 2))
    water_level: Mapped[float] = mapped_column(Numeric(6, 2))
