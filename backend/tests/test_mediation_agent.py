"""Mediation agent: only the no-key fallback is tested here (no network call
to Anthropic) — same pattern as test_assistant.py's config gate."""

from app.core.config import settings
from app.services.mediation_agent import mediate_objection


def test_mediate_objection_returns_none_without_api_key(monkeypatch):
    monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", "")
    result = mediate_objection(
        farmer_name="Farmer A",
        canal_name="C1",
        reason_label="Crop is in a critical stage",
        details="Sugarcane wilting",
        requested=400.0,
        previous_allocated=400.0,
        revised_allocated=350.0,
        changed=True,
        urgency="high",
        total_demand=1200.0,
        available_water=1000.0,
        shortage=200.0,
        evidence=["Shortage: 200.00 units — conflict detected"],
        lang="en",
    )
    assert result is None
