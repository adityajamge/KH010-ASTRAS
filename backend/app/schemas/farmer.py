from pydantic import BaseModel

from app.models.enums import PriorityLevel
from app.schemas.common import TimestampedRead


class FarmerCreate(BaseModel):
    name: str
    village: str
    phone: str
    canal_id: int | None = None
    field_id: int | None = None


class FarmerRead(TimestampedRead):
    name: str
    village: str
    phone: str
    canal_id: int | None
    field_id: int | None


class FieldCreate(BaseModel):
    farmer_id: int
    area_acres: float
    crop: str
    crop_stage: str
    priority: PriorityLevel = PriorityLevel.NORMAL


class FieldRead(TimestampedRead):
    farmer_id: int
    area_acres: float
    crop: str
    crop_stage: str
    priority: PriorityLevel
