from pydantic import BaseModel

from app.models.enums import (
    AgreementStatus,
    ConflictStatus,
    ObjectionReason,
    ObjectionStatus,
    PriorityLevel,
)
from app.schemas.common import ORMBase, TimestampedRead


class ConflictCreate(BaseModel):
    conflict_code: str
    canal_id: int
    total_demand: float
    available_water: float
    shortage: float
    priority: PriorityLevel = PriorityLevel.NORMAL
    proposal: str | None = None


class ConflictRead(TimestampedRead):
    conflict_code: str
    canal_id: int
    status: ConflictStatus
    total_demand: float
    available_water: float
    shortage: float
    priority: PriorityLevel
    proposal: str | None


class ConflictParticipantCreate(BaseModel):
    conflict_id: int
    farmer_id: int
    request_id: int | None = None


class ConflictParticipantRead(ORMBase):
    id: int
    conflict_id: int
    farmer_id: int
    request_id: int | None


class ObjectionCreate(BaseModel):
    conflict_id: int
    farmer_id: int
    reason: ObjectionReason
    details: str | None = None


class ObjectionRead(TimestampedRead):
    conflict_id: int
    farmer_id: int
    reason: ObjectionReason
    details: str | None
    status: ObjectionStatus


class AgreementCreate(BaseModel):
    agreement_code: str
    conflict_id: int | None = None
    canal_id: int | None = None
    version: int = 1
    final_allocation: dict[str, float]
    participants: list[int]
    reason: str | None = None
    approved_by: str | None = None
    supersedes_id: int | None = None


class AgreementRead(TimestampedRead):
    agreement_code: str
    conflict_id: int | None
    canal_id: int | None
    status: AgreementStatus
    version: int
    final_allocation: dict[str, float]
    participants: list[int]
    reason: str | None
    approved_by: str | None
    supersedes_id: int | None
