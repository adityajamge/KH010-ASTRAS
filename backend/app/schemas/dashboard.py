"""Farmer-dashboard shapes: one summary call powers the whole dashboard."""

from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models.enums import ObjectionReason, PriorityLevel
from app.schemas.common import ORMBase
from app.schemas.conflict import AgreementRead
from app.schemas.request import AllocationRead, DeliveryRead, ScheduleRead, WaterRequestRead
from app.schemas.system import NotificationRead


class WaterRequestSubmit(BaseModel):
    """Body for POST /requests — farmer_id comes from the session, not the client."""

    quantity_requested: float = Field(gt=0, le=100000)
    request_date: date
    preferred_time: str = Field(min_length=1, max_length=20)
    duration_hours: float = Field(gt=0, le=24)
    crop: str = Field(min_length=1, max_length=80)
    urgency: PriorityLevel = PriorityLevel.NORMAL


class WaterAdvisory(ORMBase):
    """Canal-water advisory computed from live canal state (no weather station)."""

    flow_state: str  # "low" | "normal" | "high" | "unknown"
    has_conflict: bool
    lines: list[str]


class ActivityItem(ORMBase):
    title: str
    meta: str
    created_at: datetime


class FarmerDashboardSummary(ORMBase):
    """Everything the farmer dashboard home + sections need in one call."""

    farmer_name: str
    canal_name: str | None
    # Stat cards. Available = canal current_flow; remaining = allocated - delivered.
    available_water: float
    allocated_water: float
    remaining_water: float
    has_request: bool
    current_allocation: AllocationRead | None
    current_request: WaterRequestRead | None
    delivery: DeliveryRead | None
    upcoming_schedules: list[ScheduleRead]
    allocations: list[AllocationRead]
    requests: list[WaterRequestRead]
    notifications: list[NotificationRead]
    recent_activity: list[ActivityItem]
    advisory: WaterAdvisory


class MediationView(ORMBase):
    """Current proposal + evidence for the negotiation center."""

    has_proposal: bool
    requested: float
    allocated: float
    reason: str | None
    status: str | None
    conflict_code: str | None
    evidence: list[str]
    objection_options: list[str]


class ObjectionSubmit(BaseModel):
    reason: ObjectionReason
    details: str | None = Field(default=None, max_length=500)


class ObjectionResult(ORMBase):
    requested: float
    previous_allocated: float
    allocated: float
    changed: bool
    reason: str | None
    evidence: list[str]
    conflict_code: str | None
    urgency: str


class AcceptResult(ORMBase):
    agreement: AgreementRead
    allocated: float


# ---------- Dam dashboard ----------


class StatCard(ORMBase):
    label: str
    value: str
    tone: str | None = None  # "ok" | "warn" | "danger"


class CanalReleaseRow(ORMBase):
    canal: str
    requested: float
    approved: float
    released: float
    received: float
    difference: float
    status: str


class RainfallRead(ORMBase):
    last_24h: float
    forecast: str
    catchment: str


class FlowStageRead(ORMBase):
    label: str
    value: float
    note: str | None = None


class FlowChainRead(ORMBase):
    """Live water-accounting chain for the reservoir panel.

    Unaccounted = received − delivered − expected loss; it includes water
    still waiting in unallocated balance or pending delivery, hence the note.
    ``alert`` follows the panel's rule: unaccounted above 15% of received
    flow needs canal-level investigation.
    """

    stages: list[FlowStageRead]
    unaccounted: float
    alert: bool
    alert_note: str | None = None


class DamDashboardSummary(ORMBase):
    """Everything the dam operator dashboard needs in one call."""

    dam_name: str
    stats: list[StatCard]
    releases: list[CanalReleaseRow]
    rainfall: RainfallRead
    flow_chain: FlowChainRead
