from pydantic import BaseModel

from app.schemas.common import TimestampedRead


class CanalCreate(BaseModel):
    name: str
    capacity: float
    current_flow: float
    water_level: float


class CanalRead(TimestampedRead):
    name: str
    capacity: float
    current_flow: float
    water_level: float


class WaterSourceCreate(BaseModel):
    name: str
    total_available: float
    current_storage: float
    inflow: float
    outflow: float


class WaterSourceRead(TimestampedRead):
    name: str
    total_available: float
    current_storage: float
    inflow: float
    outflow: float
