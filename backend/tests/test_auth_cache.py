"""Identity-cache behavior: complete profiles cache long, incomplete ones don't."""

from types import SimpleNamespace

import app.core.auth as auth_module
from app.core.auth import _cached_identity


class FakeUsers:
    def __init__(self, metadata: dict):
        self.metadata = metadata
        self.calls = 0

    def get(self, user_id: str):
        self.calls += 1
        return SimpleNamespace(public_metadata=self.metadata)


class FakeClerk:
    def __init__(self, metadata: dict):
        self.users = FakeUsers(metadata)


def test_incomplete_identity_refetches_quickly(monkeypatch):
    """dam_operator without dam_id: cached miss expires in seconds, not a minute."""
    now = [1000.0]
    monkeypatch.setattr(auth_module.time, "monotonic", lambda: now[0])
    auth_module._identity_cache.clear()

    clerk = FakeClerk({"role": "dam_operator"})
    assert _cached_identity(clerk, "u1") == ("dam_operator", None)
    assert clerk.users.calls == 1

    now[0] += 4
    assert _cached_identity(clerk, "u1") == ("dam_operator", None)
    assert clerk.users.calls == 1  # still cached

    now[0] += 2  # 6s total > 5s incomplete TTL
    clerk.users.metadata = {"role": "dam_operator", "dam_id": 1}
    assert _cached_identity(clerk, "u1") == ("dam_operator", 1)
    assert clerk.users.calls == 2


def test_complete_identity_uses_full_ttl(monkeypatch):
    now = [2000.0]
    monkeypatch.setattr(auth_module.time, "monotonic", lambda: now[0])
    auth_module._identity_cache.clear()

    clerk = FakeClerk({"role": "dam_operator", "dam_id": 1})
    assert _cached_identity(clerk, "u2") == ("dam_operator", 1)
    now[0] += 59
    assert _cached_identity(clerk, "u2") == ("dam_operator", 1)
    assert clerk.users.calls == 1
