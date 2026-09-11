from datetime import date, time

from pydantic import BaseModel

from app.models.enums import (
    AllocationStatus,
    DeliveryStatus,
    PriorityLevel,
    RequestStatus,
    ScheduleStatus,
)
from app.schemas.common import TimestampedRead


class WaterRequestCreate(BaseModel):
    farmer_id: int
    quantity_requested: float
    request_date: date
    preferred_time: str
    duration_hours: float
    crop: str
    urgency: PriorityLevel = PriorityLevel.NORMAL


class WaterRequestRead(TimestampedRead):
    farmer_id: int
    quantity_requested: float
    request_date: date
    preferred_time: str
    duration_hours: float
    crop: str
    urgency: PriorityLevel
    status: RequestStatus


class AllocationCreate(BaseModel):
    request_id: int
    farmer_id: int
    allocated_quantity: float
    allocation_date: date
    time_start: time
    time_end: time
    reason: str | None = None


class AllocationRead(TimestampedRead):
    request_id: int
    farmer_id: int
    allocated_quantity: float
    allocation_date: date
    time_start: time
    time_end: time
    reason: str | None
    status: AllocationStatus


class DeliveryCreate(BaseModel):
    allocation_id: int
    allocated_quantity: float
    delivered_quantity: float


class DeliveryRead(TimestampedRead):
    allocation_id: int
    allocated_quantity: float
    delivered_quantity: float
    delivery_status: DeliveryStatus


class ScheduleCreate(BaseModel):
    farmer_id: int
    allocation_id: int
    date: date
    start_time: time
    end_time: time
    quantity: float


class ScheduleRead(TimestampedRead):
    farmer_id: int
    allocation_id: int
    date: date
    start_time: time
    end_time: time
    quantity: float
    status: ScheduleStatus
