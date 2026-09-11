from sqlalchemy import ForeignKey, Numeric, String
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


class Canal(Base, TimestampMixin):
    __tablename__ = "canals"

    id: Mapped[int] = mapped_column(primary_key=True)
    dam_id: Mapped[int] = mapped_column(ForeignKey("dams.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(80), unique=True)
    capacity: Mapped[float] = mapped_column(Numeric(10, 2))
    current_flow: Mapped[float] = mapped_column(Numeric(10, 2))
    water_level: Mapped[float] = mapped_column(Numeric(6, 2))
