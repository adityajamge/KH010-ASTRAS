"""Shared, autouse test fixtures.

Several test modules seed a dam with id=1 against their own isolated
per-test SQLite database. app.services.network_state keeps a small
module-level cache keyed by dam_id (a deliberate perf fix — see its
docstring) that would otherwise leak a cached result from one test's
database into another test using the same dam id in the same pytest
process.
"""

import pytest

from app.core.config import settings


@pytest.fixture(autouse=True)
def _reset_network_state_cache():
    from app.services import network_state

    network_state._state_cache.clear()
    yield
    network_state._state_cache.clear()


@pytest.fixture(autouse=True)
def _no_real_llm_calls(monkeypatch):
    """The test suite must never make a real network call to an LLM
    provider — it's slow (a real provider hiccup can mean minutes, not
    seconds — this is exactly how a full run once took 20 minutes instead
    of 25 seconds: one test file exercised the objection flow without
    mocking the mediation agent, and hit the real, unbounded-by-default
    Anthropic API), it costs money on every test run, and it makes CI
    flaky on transient provider issues. Individual tests that specifically
    want to exercise the "configured" path must mock the client/agent
    function itself, never rely on a real key being unset by accident.
    """
    monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", "")
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "")
