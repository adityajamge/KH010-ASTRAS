"""Deterministic water-allocation engine (PS14 §§12–14).

Pure functions only — no database, no LLM, no I/O. The LLM/mediation layer
may *explain* a proposal, but litres are decided here so the numbers are
reproducible and every constraint is checked in code.

Rules (explicit fairness model):
- Priority weights: normal=1.0, high=1.5, critical=2.0.
- Minimum fair share: 50% of each farmer's requested quantity, granted when
  the floors fit inside available water; otherwise a straight proportional
  split (documented in the evidence).
- Caps: nobody is allocated more than they requested.
- Water balance: the sum of allocations never exceeds available water
  (amounts are rounded *down* to 2 decimals; leftover dust stays unallocated).
- Canal capacity is reported as evidence; callers pass
  ``available = min(canal.current_flow, canal.capacity)`` so capacity is
  enforced by construction.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta

from app.models.enums import PriorityLevel

PRIORITY_WEIGHTS: dict[PriorityLevel, float] = {
    PriorityLevel.NORMAL: 1.0,
    PriorityLevel.HIGH: 1.5,
    PriorityLevel.CRITICAL: 2.0,
}

#: Minimum fair share as a fraction of requested quantity (PS14 §13).
MIN_SHARE_FRACTION = 0.5

#: Assumed canal flow rate used to turn litres into schedule slots.
FLOW_RATE_UNITS_PER_HOUR = 175.0

#: Expected physical loss (seepage/evaporation) as a fraction of canal
#: received water. Prototype constant from PS14 §6's example network
#: (``loss_percentage: 8``) — replaced by sensor data in real deployment.
EXPECTED_LOSS_FRACTION = 0.08

#: Unaccounted water above this fraction of received flow triggers the
#: canal-level investigation alert shown on the dam dashboard.
UNACCOUNTED_ALERT_FRACTION = 0.15

#: Irrigation day starts at 06:00; slots run sequentially per canal per date.
DAY_START = time(6, 0)

_EPS = 1e-9


@dataclass
class Claim:
    """One farmer's open request entering the allocation round."""

    farmer_id: int
    request_id: int
    requested: float
    urgency: PriorityLevel = PriorityLevel.NORMAL


@dataclass
class EngineOutcome:
    """Result of one allocation round."""

    allocations: dict[int, float]  # request_id -> allocated quantity
    total_demand: float
    available_water: float
    shortage: float
    has_conflict: bool
    evidence: list[str] = field(default_factory=list)


def _round_down(value: float, decimals: int = 2) -> float:
    factor = 10**decimals
    # Tiny epsilon counters binary-float wobble (e.g. 349.9999999 -> 350.00).
    return int(value * factor + 1e-6) / factor


def detect_shortage(available_water: float, total_demand: float) -> float:
    """Positive when demand outstrips supply (PS14 §12.2 conflict signal)."""
    return max(0.0, _round_down(total_demand - available_water))


def allocate(available_water: float, claims: list[Claim]) -> EngineOutcome:
    """Split ``available_water`` across ``claims`` per the fairness rules."""
    available_water = max(0.0, available_water)
    total_demand = _round_down(sum(c.requested for c in claims))
    evidence = [
        f"Available water: {available_water:.2f} units",
        f"Total demand: {total_demand:.2f} units",
    ]

    if not claims:
        return EngineOutcome({}, total_demand, available_water, 0.0, False, evidence)

    shortage = detect_shortage(available_water, total_demand)
    if shortage <= 0:
        allocations = {c.request_id: _round_down(c.requested) for c in claims}
        evidence.append("Demand fits inside supply — every request fully allocated")
        evidence.append("Constraint respected: sum(allocations) <= available water")
        return EngineOutcome(allocations, total_demand, available_water, 0.0, False, evidence)

    evidence.append(f"Shortage: {shortage:.2f} units — conflict detected")

    floors = {c.request_id: _round_down(c.requested * MIN_SHARE_FRACTION) for c in claims}
    if sum(floors.values()) > available_water + _EPS:
        # Floors don't fit: fall back to a straight proportional split.
        evidence.append(
            "Minimum fair shares (50% of requested) do not fit inside supply — "
            "falling back to proportional split"
        )
        allocations = _proportional(available_water, claims, {c.request_id: 0.0 for c in claims})
    else:
        evidence.append("Minimum fair share granted: 50% of each request")
        allocations = _proportional(
            available_water - sum(floors.values()), claims, floors
        )

    # Round down so the balance constraint holds exactly; dust stays unallocated.
    allocations = {rid: _round_down(qty) for rid, qty in allocations.items()}
    by_farmer = {c.request_id: c for c in claims}
    for rid, qty in allocations.items():
        requested = by_farmer[rid].requested
        if qty - requested > 0.01:
            raise ValueError(f"Engine violated cap: {qty} > requested {requested}")
    if sum(allocations.values()) - available_water > 0.01:
        raise ValueError("Engine violated water balance: sum exceeds available")
    evidence.append("Constraint respected: sum(allocations) <= available water")
    evidence.append("Constraint respected: allocation <= requested for every farmer")
    return EngineOutcome(allocations, total_demand, available_water, shortage, True, evidence)


def _proportional(
    pool: float, claims: list[Claim], base: dict[int, float]
) -> dict[int, float]:
    """Iteratively share ``pool`` by priority weight over remaining headroom."""
    allocations = dict(base)
    headroom = {
        c.request_id: max(0.0, c.requested - allocations[c.request_id]) for c in claims
    }
    weights = {c.request_id: PRIORITY_WEIGHTS[c.urgency] for c in claims}
    remaining = pool
    for _ in range(10):
        open_claims = [c for c in claims if headroom[c.request_id] > _EPS]
        if not open_claims or remaining <= _EPS:
            break
        denom = sum(weights[c.request_id] * headroom[c.request_id] for c in open_claims)
        if denom <= _EPS:
            break
        given_total = 0.0
        for c in open_claims:
            share = remaining * weights[c.request_id] * headroom[c.request_id] / denom
            give = min(share, headroom[c.request_id])
            allocations[c.request_id] += give
            headroom[c.request_id] -= give
            given_total += give
        remaining -= given_total
        if given_total <= _EPS:
            break
    return allocations


@dataclass
class Slot:
    request_id: int
    farmer_id: int
    quantity: float
    start: time
    end: time


def plan_slots(
    slot_date: date,
    items: list[tuple[int, int, float]],
    start: time = DAY_START,
    flow_rate: float = FLOW_RATE_UNITS_PER_HOUR,
) -> list[Slot]:
    """Lay non-overlapping irrigation slots sequentially from ``start``.

    ``items`` are (request_id, farmer_id, quantity) in slot order. Duration
    is quantity / flow_rate. Times are minute-resolution.
    """
    cursor = datetime.combine(slot_date, start)
    slots: list[Slot] = []
    for request_id, farmer_id, quantity in items:
        minutes = max(1, round(quantity / flow_rate * 60))
        end = cursor + timedelta(minutes=minutes)
        slots.append(
            Slot(
                request_id=request_id,
                farmer_id=farmer_id,
                quantity=_round_down(quantity),
                start=cursor.time(),
                end=end.time(),
            )
        )
        cursor = end
    return slots


def build_reason(
    requested: float,
    allocated: float,
    outcome: EngineOutcome,
    revised: bool = False,
) -> str:
    """Glass-box explanation (PS14 §19): numbers + constraints, no LLM prose."""
    head = "Revised proposal" if revised else "Allocation proposal"
    lines = [
        f"{head}: {allocated:.2f} of {requested:.2f} requested.",
        f"Available water {outcome.available_water:.2f}, total demand "
        f"{outcome.total_demand:.2f}, shortage {outcome.shortage:.2f}.",
    ]
    lines.extend(outcome.evidence)
    return " ".join(lines)


# ---------------------------------------------------------------------------
# Deterministic status classifiers — shared by the dam/farmer dashboards
# (app/api/v1/endpoints/dashboard.py) and the 3D digital twin
# (app/services/network_state.py) so both read the exact same thresholds.
# No sensor exists for a physical gate; ``flow_state`` is a derived indicator
# from current_flow vs. capacity, not a hardware reading.
# ---------------------------------------------------------------------------


def flow_state(current_flow: float, capacity: float) -> str:
    """"low" / "normal" / "high" from current flow as a fraction of capacity."""
    ratio = float(current_flow) / float(capacity) if float(capacity) > 0 else 0.0
    if ratio < 0.5:
        return "low"
    if ratio > 0.95:
        return "high"
    return "normal"


def release_status(released: float, difference: float, approved: float, received: float) -> str:
    """"Normal" / "Minor Difference" / "Needs Investigation" for a canal's
    released-vs-received water accounting (dam dashboard §4 reservoir panel)."""
    if approved <= 0 and received <= 0:
        # Nothing expected on this canal yet — not "missing", just unused.
        return "Normal"
    if released <= 0:
        return "Normal"
    ratio = difference / released
    if ratio < 0.05:
        return "Normal"
    if ratio < 0.15:
        return "Minor Difference"
    return "Needs Investigation"


def dam_status(storage: float, available: float) -> tuple[str, str | None]:
    """Dam health label + UI tone from stored versus allocatable water."""
    if available <= 0:
        return ("Unknown", None)
    ratio = storage / available
    if ratio >= 1:
        return ("Normal", "ok")
    if ratio >= 0.5:
        return ("Watch", "warn")
    return ("Critical", "danger")
