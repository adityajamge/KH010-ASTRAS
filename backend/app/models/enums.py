"""Enumerations shared across ORM models.

Values are transcribed from docs/Dashboards/PS14_Dashboard_Feature_Specification.md
where the spec enumerates them explicitly (allocation status §3.5, objection
reasons §3.7); the rest are a reasonable synthesis of the workflows it
describes.
"""

import enum


class PriorityLevel(str, enum.Enum):
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"


class RequestStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    PROPOSED = "proposed"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class AllocationStatus(str, enum.Enum):
    """docs/Dashboards/PS14_Dashboard_Feature_Specification.md §3.5"""

    PENDING = "pending"
    PROPOSED = "proposed"
    ACCEPTED = "accepted"
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    MODIFIED = "modified"
    CANCELLED = "cancelled"
    DISPUTED = "disputed"


class DeliveryStatus(str, enum.Enum):
    ON_TRACK = "on_track"
    COMPLETE = "complete"
    UNDER_DELIVERY = "under_delivery"
    OVER_DELIVERY = "over_delivery"
    INVESTIGATION_REQUIRED = "investigation_required"


class ConflictStatus(str, enum.Enum):
    DETECTED = "detected"
    UNDER_REVIEW = "under_review"
    NEGOTIATION = "negotiation"
    APPROVED = "approved"
    REVISION_REQUESTED = "revision_requested"
    ESCALATED = "escalated"
    RESOLVED = "resolved"


class ObjectionReason(str, enum.Enum):
    """docs/Dashboards/PS14_Dashboard_Feature_Specification.md §3.7"""

    NEED_MORE_WATER = "NEED_MORE_WATER"
    NEED_DIFFERENT_TIME = "NEED_DIFFERENT_TIME"
    CROP_CRITICAL = "CROP_CRITICAL"
    EMERGENCY = "EMERGENCY"
    OTHER = "OTHER"


class ObjectionStatus(str, enum.Enum):
    PENDING = "pending"
    RESOLVED = "resolved"
    REJECTED = "rejected"


class AgreementStatus(str, enum.Enum):
    PROPOSED = "proposed"
    ACCEPTED = "accepted"
    SUPERSEDED = "superseded"
    CANCELLED = "cancelled"


class ScheduleStatus(str, enum.Enum):
    PENDING = "pending"
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class AnomalyStatus(str, enum.Enum):
    INVESTIGATION_REQUIRED = "investigation_required"
    INVESTIGATING = "investigating"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"


class NotificationSeverity(str, enum.Enum):
    """docs/Dashboards/PS14_Dashboard_Feature_Specification.md §9"""

    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


class ActorType(str, enum.Enum):
    FARMER = "farmer"
    JAL_VIGYANI = "jal_vigyani"
    DAM_OPERATOR = "dam_operator"
    SYSTEM = "system"
    AI_AGENT = "ai_agent"


class ChannelType(str, enum.Enum):
    """Which surface an assistant message came through — same backend and
    agent workflow either way (docs/PS14_Water_Sharing_Mediation_Agent.md
    "AI Chat + Twilio")."""

    WEB = "web"
    TWILIO = "twilio"


class MessageRole(str, enum.Enum):
    USER = "user"
    ASSISTANT = "assistant"
