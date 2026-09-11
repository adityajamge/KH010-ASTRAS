"""Response/request shapes specific to the Jal Vigyani dashboard.

These aren't 1:1 ORM reads (see app/schemas/*.py for those) — they're
cross-table views the dashboard needs: farmer name joined onto an
allocation row, participant/objection detail joined onto a conflict, dam +
canal + counts bundled into one overview call.
"""

from datetime import date, time
from typing import Literal

from pydantic import BaseModel

from app.models.enums import (
    ConflictStatus,
    DeliveryStatus,
    ObjectionReason,
    ObjectionStatus,
    PriorityLevel,
    ScheduleStatus,
)
from app.schemas.network import CanalRead, DamRead


class JalVigyaniOverview(BaseModel):
    dam: DamRead
    canals: list[CanalRead]
    farmer_count: int
    active_conflicts: int
    active_anomalies: int
    under_delivery_count: int


class FarmerAllocationSummary(BaseModel):
    """docs/Dashboards/PS14_Dashboard_Feature_Specification.md §4.5"""

    farmer_id: int
    farmer_name: str
    requested: float | None
    allocated: float | None
    delivered: float | None
    shortfall: float | None
    status: str


class UnderDeliveryRow(BaseModel):
    delivery_id: int
    farmer_id: int
    farmer_name: str
    allocated_quantity: float
    delivered_quantity: float
    shortfall: float
    status: DeliveryStatus


class CanalScheduleRow(BaseModel):
    """docs/Dashboards/PS14_Dashboard_Feature_Specification.md §4.10"""

    schedule_id: int
    farmer_id: int
    farmer_name: str
    date: date
    start_time: time
    end_time: time
    quantity: float
    status: ScheduleStatus


class ConflictParticipantDetail(BaseModel):
    farmer_id: int
    farmer_name: str
    request_id: int | None


class ObjectionDetail(BaseModel):
    id: int
    farmer_id: int
    farmer_name: str
    reason: ObjectionReason
    details: str | None
    status: ObjectionStatus


class ConflictDetail(BaseModel):
    """docs/Dashboards/PS14_Dashboard_Feature_Specification.md §4.6"""

    id: int
    conflict_code: str
    canal_id: int
    status: ConflictStatus
    total_demand: float
    available_water: float
    shortage: float
    priority: PriorityLevel
    proposal: str | None
    participants: list[ConflictParticipantDetail]
    objections: list[ObjectionDetail]


class ConflictDecisionRequest(BaseModel):
    """§4.6 actions: Review is just viewing (no endpoint needed);
    Approve / Request Revision / Escalate each move the conflict's status."""

    action: Literal["approve", "request_revision", "escalate"]
    note: str | None = None


class FarmerCanalRow(BaseModel):
    """One farmer visible for canal assignment: unassigned farmers plus
    farmers on this dam's canals. Farmers on other dams never appear."""

    farmer_id: int
    farmer_name: str
    village: str
    phone: str
    canal_id: int | None
    canal_name: str | None


class CanalAssignmentRequest(BaseModel):
    """Assign (or with null, unassign) a farmer's canal. The canal must
    belong to the caller's dam — cross-dam assignment is rejected."""

    canal_id: int | None = None
