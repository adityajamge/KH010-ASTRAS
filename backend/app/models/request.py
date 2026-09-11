from datetime import date, time

from sqlalchemy import Date, ForeignKey, Numeric, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin
from app.models.enums import (
    AllocationStatus,
    DeliveryStatus,
    PriorityLevel,
    RequestStatus,
    ScheduleStatus,
)


class WaterRequest(Base, TimestampMixin):
    __tablename__ = "water_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    farmer_id: Mapped[int] = mapped_column(ForeignKey("farmers.id", ondelete="CASCADE"))
    quantity_requested: Mapped[float] = mapped_column(Numeric(10, 2))
    request_date: Mapped[date] = mapped_column(Date)
    preferred_time: Mapped[str] = mapped_column(String(20))
    duration_hours: Mapped[float] = mapped_column(Numeric(4, 2))
    crop: Mapped[str] = mapped_column(String(80))
    urgency: Mapped[PriorityLevel] = mapped_column(default=PriorityLevel.NORMAL)
    status: Mapped[RequestStatus] = mapped_column(default=RequestStatus.PENDING)


class Allocation(Base, TimestampMixin):
    __tablename__ = "allocations"

    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(
        ForeignKey("water_requests.id", ondelete="CASCADE")
    )
    # Denormalized for read-heavy dashboard queries (also on water_requests).
    farmer_id: Mapped[int] = mapped_column(ForeignKey("farmers.id", ondelete="CASCADE"))
    allocated_quantity: Mapped[float] = mapped_column(Numeric(10, 2))
    allocation_date: Mapped[date] = mapped_column(Date)
    time_start: Mapped[time] = mapped_column(Time)
    time_end: Mapped[time] = mapped_column(Time)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[AllocationStatus] = mapped_column(default=AllocationStatus.PENDING)


class Delivery(Base, TimestampMixin):
    __tablename__ = "deliveries"

    id: Mapped[int] = mapped_column(primary_key=True)
    allocation_id: Mapped[int] = mapped_column(
        ForeignKey("allocations.id", ondelete="CASCADE")
    )
    allocated_quantity: Mapped[float] = mapped_column(Numeric(10, 2))
    delivered_quantity: Mapped[float] = mapped_column(Numeric(10, 2))
    delivery_status: Mapped[DeliveryStatus] = mapped_column(
        default=DeliveryStatus.ON_TRACK
    )


class Schedule(Base, TimestampMixin):
    __tablename__ = "schedules"

    id: Mapped[int] = mapped_column(primary_key=True)
    farmer_id: Mapped[int] = mapped_column(ForeignKey("farmers.id", ondelete="CASCADE"))
    allocation_id: Mapped[int] = mapped_column(
        ForeignKey("allocations.id", ondelete="CASCADE")
    )
    date: Mapped[date] = mapped_column(Date)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    quantity: Mapped[float] = mapped_column(Numeric(10, 2))
    status: Mapped[ScheduleStatus] = mapped_column(default=ScheduleStatus.PENDING)
