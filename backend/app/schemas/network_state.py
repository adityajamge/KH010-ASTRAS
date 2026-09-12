"""3D digital twin state (docs/PS14_Water_Sharing_Mediation_Agent.md §§7-10).

Every field here is read from the same tables/services the dashboards use
(app/services/network_state.py) — the twin renders exactly what the
deterministic backend already computed, nothing more.
"""

from datetime import datetime

from pydantic import BaseModel


class TwinFarmer(BaseModel):
    farmer_id: int
    name: str
    canal_id: int
    #: 0-based position along the canal (0 = head-end), used for 3D layout —
    #: a rendering convenience, not a measured physical distance.
    order_index: int
    position_label: str  # "head" | "middle" | "tail"
    requested: float | None
    allocated: float | None
    delivered: float | None
    shortfall: float | None
    status: str  # raw status from the delivery/allocation/request row
    has_conflict: bool
    has_pending_objection: bool
    #: Normalized for visualization: normal | shortage | conflict |
    #: pending_mediation | approved | delivery_issue.
    twin_status: str


class TwinCanal(BaseModel):
    canal_id: int
    name: str
    capacity: float
    current_flow: float
    water_level: float
    #: "low" | "normal" | "high" — current_flow vs. capacity. No physical
    #: gate sensor exists in this prototype, so this is a derived flow
    #: indicator, not a hardware gate reading.
    flow_state: str
    #: "Normal" | "Minor Difference" | "Needs Investigation" — released vs.
    #: received water accounting (same rule as the dam dashboard).
    release_status: str
    requested: float
    approved: float
    released: float
    received: float
    difference: float
    active_conflicts: int
    active_anomalies: int
    farmers: list[TwinFarmer]


class TwinReservoir(BaseModel):
    dam_id: int
    name: str
    water_level: float
    current_storage: float
    total_available: float
    inflow: float
    outflow: float
    rainfall_last_24h: float
    status: str  # "Normal" | "Watch" | "Critical" | "Unknown"
    status_tone: str | None


class NetworkStateResponse(BaseModel):
    #: Always true for this hackathon prototype (docs/PS14 §22) — surfaced so
    #: the UI can label the twin as a simulation rather than live telemetry.
    is_simulated: bool
    simulation_note: str
    generated_at: datetime
    dam: TwinReservoir
    canals: list[TwinCanal]
    total_active_conflicts: int
    total_active_anomalies: int
