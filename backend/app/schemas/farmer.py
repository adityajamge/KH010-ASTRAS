from pydantic import BaseModel, Field

from app.models.enums import PriorityLevel
from app.schemas.common import TimestampedRead


class VillageRead(TimestampedRead):
    name: str


class FarmerCreate(BaseModel):
    name: str
    village_id: int
    phone: str
    canal_id: int | None = None
    field_id: int | None = None


class FarmerRead(TimestampedRead):
    name: str
    village_id: int
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


class FarmerOnboardingField(BaseModel):
    """The farmer's primary field, collected in the same onboarding step."""

    area_acres: float = Field(gt=0)
    crop: str = Field(min_length=1, max_length=80)
    crop_stage: str = Field(min_length=1, max_length=80)
    priority: PriorityLevel = PriorityLevel.NORMAL


class FarmerOnboardingRequest(BaseModel):
    """Body for POST /farmers/onboard — the farmer profile form.

    No village field: every farmer is auto-assigned to village id 1
    (single-village prototype) rather than choosing one.
    """

    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=1, max_length=20)
    canal_id: int | None = None
    field: FarmerOnboardingField


class FarmerProfileRead(FarmerRead):
    """Farmer profile plus their fields, returned by GET /farmers/me."""

    fields: list[FieldRead]
