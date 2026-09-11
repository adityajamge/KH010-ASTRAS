from pydantic import BaseModel

from app.schemas.common import TimestampedRead


class DamRead(TimestampedRead):
    """Dams are seeded infrastructure — no DamCreate schema on purpose."""

    name: str
    village_id: int
    total_available: float
    current_storage: float
    inflow: float
    outflow: float


class CanalCreate(BaseModel):
    dam_id: int
    name: str
    capacity: float
    current_flow: float
    water_level: float


class CanalRead(TimestampedRead):
    dam_id: int
    name: str
    capacity: float
    current_flow: float
    water_level: float
