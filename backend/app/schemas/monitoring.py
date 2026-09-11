from datetime import datetime

from pydantic import BaseModel

from app.models.enums import AnomalyStatus
from app.schemas.common import ORMBase, TimestampedRead


class SensorReadingCreate(BaseModel):
    canal_id: int
    location: str
    flow: float
    water_level: float


class SensorReadingRead(ORMBase):
    id: int
    canal_id: int
    location: str
    flow: float
    water_level: float
    recorded_at: datetime


class AnomalyCreate(BaseModel):
    canal_id: int
    code: str
    location: str
    expected_value: float
    measured_value: float
    difference: float
    possible_causes: list[str]


class AnomalyRead(TimestampedRead):
    canal_id: int
    code: str
    location: str
    expected_value: float
    measured_value: float
    difference: float
    status: AnomalyStatus
    possible_causes: list[str]
