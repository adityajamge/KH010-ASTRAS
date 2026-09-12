"""Per-acre water norms behind the max-request cap (loopholes doc §2.1).

Formula: ``max_allowed = total_area_acres * norm_per_acre(crop, stage) * TOLERANCE``

- ``norm`` = approved prototype units per acre for that crop + growth stage.
  These are *prototype placeholders* until a Jal Vigyani / agri-dept table
  replaces them — magnitudes are chosen to fit the prototype's abstract
  "units" (dam ~50,000, typical request 300-800 for 2.5 acres).
- ``tolerance`` = slack buffer for soil/weather/meter variation, so a
  genuine farmer just over the ideal line isn't hard-blocked.
"""

from __future__ import annotations

#: Slack buffer — 1.25 = allow 25% over the ideal norm.
TOLERANCE = 1.25

#: Base prototype units per acre, keyed by lowercased crop name.
CROP_BASE_NORMS: dict[str, float] = {
    "sugarcane": 1800.0,
    "rice": 1600.0,
    "paddy": 1600.0,
    "cotton": 1200.0,
    "wheat": 1000.0,
    "maize": 900.0,
    "corn": 900.0,
    "soybean": 800.0,
    "vegetables": 1100.0,
    "vegetable": 1100.0,
    "pulses": 700.0,
    "millet": 700.0,
}

#: Growth-stage multiplier, keyed by lowercased stage. Unknown stages -> 1.0.
STAGE_FACTORS: dict[str, float] = {
    "nursery": 0.7,
    "tillering": 1.0,
    "vegetative": 1.0,
    "flowering": 1.2,
    "grain filling": 1.15,
    "maturity": 0.8,
    "harvest": 0.6,
}

#: Fallback when the crop isn't in the table.
DEFAULT_NORM_PER_ACRE = 1200.0


def _key(value: str | None) -> str:
    return (value or "").strip().lower()


def norm_per_acre(crop: str | None, crop_stage: str | None = None) -> float:
    """Units per acre for this crop+stage, before tolerance."""
    base = CROP_BASE_NORMS.get(_key(crop), DEFAULT_NORM_PER_ACRE)
    factor = STAGE_FACTORS.get(_key(crop_stage), 1.0)
    return base * factor


def max_allowed(area_acres: float, crop: str | None, crop_stage: str | None = None) -> float:
    """Max requestable units for ``area_acres`` of ``crop``/``stage``."""
    return round(float(area_acres) * norm_per_acre(crop, crop_stage) * TOLERANCE, 2)
