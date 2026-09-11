from datetime import datetime

from pydantic import BaseModel

from app.models.enums import ActorType, NotificationSeverity
from app.schemas.common import ORMBase


class NotificationCreate(BaseModel):
    farmer_id: int
    title: str
    message: str
    type: NotificationSeverity = NotificationSeverity.INFO


class NotificationRead(ORMBase):
    id: int
    farmer_id: int
    title: str
    message: str
    type: NotificationSeverity
    is_read: bool
    created_at: datetime


class AuditLogCreate(BaseModel):
    actor_type: ActorType = ActorType.SYSTEM
    actor_id: str | None = None
    action: str
    entity_type: str
    entity_id: str
    details: dict | None = None


class AuditLogRead(ORMBase):
    id: int
    actor_type: ActorType
    actor_id: str | None
    action: str
    entity_type: str
    entity_id: str
    details: dict | None
    created_at: datetime
