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
    water_level: float
    rainfall_last_24h: float
    rainfall_forecast: str


class DamSupplyUpdate(BaseModel):
    """Body for PATCH /dam — the dam operator publishing supply state.

    Every field optional; only provided fields are updated.
    """

    total_available: float | None = None
    current_storage: float | None = None
    inflow: float | None = None
    outflow: float | None = None
    water_level: float | None = None
    rainfall_last_24h: float | None = None
    rainfall_forecast: str | None = None


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
