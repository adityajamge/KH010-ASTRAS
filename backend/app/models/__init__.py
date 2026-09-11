"""Import every model so Base.metadata (and Alembic autogenerate) see them all."""

from app.db.base import Base
from app.models.assistant import AssistantMessage
from app.models.conflict import Agreement, Conflict, ConflictParticipant, Objection
from app.models.farmer import Farmer, Field
from app.models.monitoring import Anomaly, SensorReading
from app.models.network import Canal, Dam
from app.models.request import Allocation, Delivery, Schedule, WaterRequest
from app.models.system import AuditLog, Notification
from app.models.village import Village

__all__ = [
    "Base",
    "Village",
    "Farmer",
    "Field",
    "Dam",
    "Canal",
    "WaterRequest",
    "Allocation",
    "Delivery",
    "Schedule",
    "Conflict",
    "ConflictParticipant",
    "Objection",
    "Agreement",
    "SensorReading",
    "Anomaly",
    "Notification",
    "AuditLog",
    "AssistantMessage",
]
