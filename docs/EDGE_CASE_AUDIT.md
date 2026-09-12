# Edge-Case & Loophole Audit

Checked against the actual code (not the spec's intent) on the date this
was written. Each row is one of the ~80 cases from the extended PS14
"Topic-Wise Loopholes, Edge Cases & Solutions" list. Status key:

- **✅ Implemented** — verified in code, cited.
- **🔧 Fixed in this pass** — was a real gap; fixed and tested just now.
- **⚠️ Partial** — something real exists but doesn't fully cover the case.
- **❌ Not implemented** — genuinely missing. Where it needs physical
  sensor/IoT hardware this prototype doesn't have, that's stated plainly
  rather than faked (per the project's own "do not fabricate sensor data"
  principle) — those are architecture-ready gaps, not oversights.

---

## 1. Water Availability & Supply

| # | Case | Status | Notes |
|---|---|---|---|
| 1 | Sudden reduction in available water | ✅ | `dams.publish_supply_state` updates `current_storage`/`inflow`/`outflow` immediately; every canal/farmer read (`canal_available_water` = `min(current_flow, capacity)`) is live off the DB, not a cached schedule — the next allocation cycle sees it instantly. |
| 2 | Sudden increase in available water | ✅ | Same path — a farmer only gets more water on the next allocation cycle (triggered by a new request/objection), which re-runs `allocate()` under the hard caps (§13/§14 fairness model) rather than blindly handing out the increase. |
| 3 | Wrong/manual water availability entry | ✅ | `publish_supply_state` is audit-logged with before/after values, actor id and timestamp (`app/api/v1/endpoints/dams.py`) — not silently accepted. No automatic "is this plausible" check on dam-level figures (see #4 for the canal-sensor equivalent, which now has one). |
| 4 | Bad source sensor reading | 🔧 | **Was completely unvalidated.** `record_sensor_reading` now rejects negative/non-finite values, a flow reading >1.5x the canal's physical capacity, and a >4x jump from the last reading at the same location (`app/api/v1/endpoints/monitoring.py::_validate_sensor_reading`). 7 new tests in `tests/test_sensor_reading_validation.py`. |
| 5 | Water arrives late | ❌ | No physical flow sensor drives schedule activation — slots are clock-based (`app/services/allocation.py::plan_slots`). Needs a live flow signal this prototype doesn't have. |
| 6 | Water quality becomes unsuitable | ❌ | No quality data model exists at all (no pH/turbidity/contamination field anywhere). Not implemented. |

## 2. Farmer Requirement Manipulation

| # | Case | Status | Notes |
|---|---|---|---|
| 1 | Deliberately overstated demand | ⚠️ | `WaterRequestSubmit.quantity_requested` caps at a flat 100,000 (`app/schemas/dashboard.py`) — a blunt ceiling, not a per-crop/per-area validated range. There's no reference table of "expected demand per acre per crop" to check against; the engine's hard cap (never allocate more than requested) limits the *damage* of overstatement but doesn't detect the overstatement itself. |
| 2 | False urgency | ✅ | Urgency is a farmer-set enum (`normal`/`high`/`critical`) but only ever *feeds a weighting formula* (`PRIORITY_WEIGHTS` in `allocation.py`) — it cannot make an under-shortage allocation exceed what the proportional-fairness math allows. The AI Coordinator's system prompt also explicitly forbids granting priority "because the message sounds urgent" — priority only moves via the structured `urgency` field, never persuasive language. |
| 3 | Requirement changed after allocation | ✅ | A new `POST /requests` immediately triggers `run_allocation_cycle`, which recomputes every open request on the canal (`app/services/mediation.py`). |
| 4 | Repeated requirement changes | ❌ | No rate limit or change-history review trigger exists — a farmer can submit unlimited new requests. Feasible to add (mirrors the objection-escalation fix below) but not done this pass. |
| 5 | Cancellation after allocation | ❌ | No cancel endpoint exists at all — a farmer can object or let a request stand, but can't withdraw one. |
| 6 | Allocated water not used | ⚠️ | `Delivery.delivered_quantity` vs `allocated_quantity` is tracked and surfaced (`under_delivery`/`investigation_required` statuses), but nothing automatically reassigns the unused capacity to another farmer — it's visible to a Jal Vigyani, not auto-resolved. |
| 7 | Unrealistic preferred time | ❌ | **Genuine gap, verified by grep**: `preferred_time` is stored on every request but is never read by `allocation.py` or `mediation.py` — slots are assigned purely sequentially per canal (`_next_free_slot_start`). It isn't honored as a soft constraint at all, so it also can't conflict. |

## 3. Water Theft & Unauthorized Withdrawal

| # | Case | Status | Notes |
|---|---|---|---|
| 1-6 | All (unauthorized withdrawal, over-allocation withdrawal, gate manipulation, sensor tampering, collusion, upstream over-withdrawal) | ❌ | **None implemented — all require physical infrastructure this prototype doesn't have**: outlet meters, gate-position sensors, and multiple *sequential* measurement points along a canal (today there's exactly one `current_flow` reading per canal, not per-segment). The data model (`SensorReading`, `Anomaly`) is *shaped* to receive this once real sensors exist, but the detection logic itself (§13's water-balance formula) is not automated — see §13 below for what partial version *does* exist. |

## 4. Leakage, Seepage & Evaporation

| # | Case | Status | Notes |
|---|---|---|---|
| 1 | Canal leakage | ⚠️ | Handled at the *whole-canal* level, not per-segment: the dam dashboard's flow-accounting chain (`app/api/v1/endpoints/dashboard.py::_flow_chain`) computes `unaccounted = received − delivered − expected_loss` and flags "Needs Investigation" above a 15% threshold — this is real, tested logic, not a placeholder. It can't localize *which section* leaks (needs sequential sensors per #3). |
| 2 | Seepage | ✅ | The same flow chain treats an 8% loss as expected baseline (`EXPECTED_LOSS_FRACTION` in `allocation.py`) and only flags the *excess* beyond that — exactly the spec's "classify only the unexplained excess" ask. |
| 3 | Evaporation | ✅ | Covered by the same 8% baseline constant — documented as a "prototype constant" that would be weather/season-driven in a real deployment, not per-condition dynamic (no weather feed exists). |
| 4 | Heavy rainfall | ⚠️ | `Dam.rainfall_last_24h`/`rainfall_forecast` exist and are dam-operator-published, but nothing automatically cross-references a rainfall spike against a flow change — it's descriptive data, not a rule input yet. |
| 5 | Flood/overflow | ❌ | No canal water-level threshold/alert exists. |
| 6 | Leak after farmer outlet | ❌ | Would need a downstream-of-outlet measurement point that doesn't exist. |

## 5. Under-Delivery & Fairness

| # | Case | Status | Notes |
|---|---|---|---|
| 1 | Farmer receives less than allocated | ✅ | `Delivery` model computes shortfall directly; Jal Vigyani's under-delivery view (`GET /jal-vigyani/under-delivery`) surfaces it. |
| 2 | Repeated under-delivery | ❌ | No history/streak tracking — each delivery is evaluated independently. |
| 3 | Same farmer repeatedly gets priority | ✅ | Fairness scoring (`allocate()`) is need/priority-weighted per round, not history-aware, but also isn't "sticky" — nothing carries a farmer's *last* allocation forward as an advantage, so an accidental favor-loop the spec worries about structurally can't build up. No explicit historical-fairness bonus either way. |
| 4 | Minimum needs exceed supply | ✅ | `allocate()` explicitly detects when 50%-floors don't fit (`"Minimum fair shares... do not fit inside supply"` in the evidence) and falls back to a documented proportional split — the shortage and the fallback reasoning are always in the glass-box `evidence` list, never hidden. |
| 5 | Equal quantity is not fair | ✅ | Allocation is priority-weighted + proportional-to-request, never a flat equal split. |
| 6 | Large vs. small land area | ⚠️ | `Field.area_acres` is captured but is not itself a term in the allocation formula — the formula works off *requested quantity*, which a farmer sets (informed by their own area, but not cross-validated against it — same root gap as §2.1). |

## 6. Scheduling & Canal Capacity

| # | Case | Status | Notes |
|---|---|---|---|
| 1 | Two farmers get the same slot | ✅ | Fixed and tested (`test_second_request_same_date_does_not_overlap_accepted_slot`) — `_next_free_slot_start` queues new slots after the latest already-booked end time on that canal/date rather than restarting from 06:00. |
| 2 | Continuous irrigation requirement | ❌ | No "don't split this farmer's water" flag exists. |
| 3 | Canal maintenance | ❌ | No "canal unavailable" state — a canal is always assumed operable. |
| 4 | Farmer unavailable at assigned time | ❌ | No availability-window field on a farmer/request. |
| 5 | Water does not arrive at slot start | ❌ | Same physical-flow-confirmation gap as §1.5. |
| 6 | Farmer misses slot | ❌ | Same as #2.6 — no auto-reassignment of an unused slot's water. |

## 7. Negotiation & Objections

| # | Case | Status | Notes |
|---|---|---|---|
| 1 | Vague objection | ✅ | The AI Coordinator's `object_to_allocation` tool requires the LLM to classify into one of 5 structured `ObjectionReason` values before the call is even made — a vague "this is unfair" gets mapped to a reason, never passed through as free text alone. |
| 2 | Impossible demand | ✅ | The deterministic engine enforces the hard cap (never more than requested, never more than available) regardless of what the objection asks for — see §14's architecture principle. |
| 3 | Accepts then changes mind | ✅ | `Agreement` is versioned (`version`, `supersedes_id`) — a farmer can still object/re-accept after acceptance, and each acceptance freezes a new immutable version rather than mutating the old one. |
| 4 | Emotional manipulation | ✅ | Verified by grep: zero arithmetic exists in `ai_coordinator.py`. Allocation numbers only ever come from `allocation.py`; the mediation agent's system prompt explicitly states it "never decides, changes, or invents a number." |
| 5 | Repeated objections to delay others | 🔧 | **Was completely unbounded.** After 3 objections on one conflict by the same farmer, the conflict now auto-escalates (`ConflictStatus.ESCALATED`), is audit-logged (`conflict.auto_escalated`), and the farmer is notified that a Jal Vigyani will review directly — instead of looping the engine forever. New test: `test_repeated_objections_auto_escalate`. |
| 6 | Same preferred slot demanded by two farmers | ⚠️ | Can't structurally occur today since `preferred_time` isn't used for scheduling at all (§2.7) — there's no competing-preference conflict to resolve because preference isn't consulted in the first place. |

## 8. AI / ML Loopholes

| # | Case | Status | Notes |
|---|---|---|---|
| 1 | AI invents a rule | ✅ | Architectural guarantee, not a filter: allocation math lives only in `allocation.py`; the coordinator and mediation agent can only call tools or write prose. |
| 2 | AI misunderstands a request | ⚠️ | Tool-call arguments are validated (missing/malformed args degrade to an error tool result — see `test_malformed_tool_arguments_do_not_crash_the_turn`), but there's no explicit "ask for confirmation when confidence is low" behavior — a misread request just produces a tool error, not a clarifying question. |
| 3 | AI favors persuasive users | ✅ | Same separation as #8.1 — language understanding (LLM) and allocation scoring (`allocation.py`) are different modules with no path for the former to influence the latter's numbers. |
| 4 | Incorrect explanation | ✅ | `build_reason()` generates the evidence text from the actual constraint-check trace (available water, demand, shortage, which constraint fired) — the LLM mediation agent is instructed to cite only those given facts, and the deterministic `reason` field is always present as the ground truth even when the LLM layer is unavailable. |
| 5 | False anomaly alarm | ⚠️ | Anomalies are 100% human-reported (JV-US-03) — there's no ML/statistical detection to produce a false positive from *in the first place*. This avoids the failure mode by not having the feature, not by combining ML with rule-based guards as the spec suggests. |
| 6 | Too little historical data | N/A | No ML model exists in the system at all — ties to #8.5. |

## 9. IoT / Sensor / Hardware Edge Cases

| # | Case | Status | Notes |
|---|---|---|---|
| 1 | Sensor failure | 🔧 (partial) | Range/finite checks now reject a stuck-at-impossible-value reading before it's stored (see §1.4). No device-heartbeat concept exists since there's no real device. |
| 2 | Calibration drift | 🔧 (partial) | The rate-of-change check catches a *sudden* drift-like jump; a *slow* drift across many small steps would not trip it — that needs a longer trend baseline, not implemented. |
| 3 | Network failure | ❌ | Readings are entered directly via the API/UI, not transmitted from a device — there's no transmission path to fail. |
| 4 | Power failure | N/A | No physical device. |
| 5 | Sensors disagree | 🔧 (partial) | Two readings at *different* `location` values on the same canal aren't cross-checked against each other today — only same-location consecutive readings are. |
| 6 | Delayed reading mistaken for current | ⚠️ | Every `SensorReading` has a real `recorded_at` timestamp, but nothing in the API/UI currently flags an old reading as stale when it's displayed. |
| 7 | Level mistaken for volume | ✅ | `flow` and `water_level` are separate fields throughout — no code path treats a level reading as a volume/flow figure. |

## 10. Dynamic Changes / Real-Time Edge Cases

| # | Case | Status | Notes |
|---|---|---|---|
| 1 | Farmer adds a new request | ✅ | `run_allocation_cycle` recomputes every open request on the canal, not just the new one — existing accepted schedules are preserved (see §6.1's fix) while open ones are re-optimized. |
| 2 | Farmer withdraws request | ❌ | Same gap as #2.5 — no withdraw/cancel path exists. |
| 3 | Emergency crop condition | ✅ | `urgency: critical` + an objection reason of `CROP_CRITICAL` raises priority weight through the same validated path as #2.2 — not a special-cased shortcut. |
| 4 | Canal blockage | ❌ | No "reduced capacity" event/state — a canal's `capacity` only changes if a dam operator manually edits it (no such endpoint currently exists for canals, only for the dam). |
| 5 | Sudden infrastructure repair | ❌ | Same as #6.3 — no canal-unavailable state. |
| 6 | Multiple simultaneous changes | ✅ | `run_allocation_cycle` is one atomic pass over *all* open requests on a canal per invocation — concurrent changes are naturally coalesced into the next single recalculation, not processed as separate races. |

## 11. Audit, Accountability & Security

| # | Case | Status | Notes |
|---|---|---|---|
| 1 | Decision cannot be explained | ✅ | Every allocation's `reason` is generated from the actual constraint trace (`build_reason`), and the AI's `get_status` tool exposes the same evidence — nothing is a black box. |
| 2 | Past schedule is overwritten | ✅ | `Agreement.version` + `supersedes_id` chain — an old agreement is marked `SUPERSEDED`, never deleted or mutated. |
| 3 | Manual override by authority | ✅ | `publish_supply_state` (dam operator) and `decide_conflict` (Jal Vigyani) are both audit-logged with actor id, role, timestamp, and before/after values. |
| 4 | False complaint | ✅ | `Delivery.delivered_quantity` is the recorded evidence a Jal Vigyani/AI cites — a complaint contradicted by the delivery record is verifiable, not taken on faith. |
| 5 | Data manipulation | ⚠️ | Role-scoped access control exists throughout (Clerk role + `dam_id` checks on every endpoint) and `audit_logs`/`assistant_messages` are append-only tables in normal application use — but there's no cryptographic tamper-evidence (e.g. hash chaining) at the database layer; a direct DB write could still alter history undetected. |
| 6 | Unresolved dispute | ✅ | `ConflictStatus.ESCALATED` (now reachable both manually via Jal Vigyani decision *and* automatically via the new repeated-objection fix) preserves the latest proposal rather than forcing a fabricated agreement. |

## 12. No-Feasible-Solution Cases

| # | Case | Status | Notes |
|---|---|---|---|
| 1 | Total minimum demand > available water | ✅ | See §5.4 — explicitly detected and surfaced in evidence, with a documented proportional-split fallback rather than a constraint violation. |
| 2 | All farmers demand the same time | N/A | Can't occur — see §2.7/§7.6, preferred time isn't a scheduling input. |
| 3 | Demand exceeds canal capacity even with enough total water | ✅ | `canal_available_water() = min(current_flow, capacity)` — capacity is a hard ceiling on every allocation round by construction, not a soft target. |
| 4 | Emergency conflicts with an existing critical allocation | ✅ | Both compete through the same `PRIORITY_WEIGHTS`-driven proportional split — two `critical` claims split proportionally to their requested amounts under the same shortage math as any other pair, with the trade-off visible in `evidence`. |

## 13. Water-Balance Detection Formula

**⚠️ Partially implemented, and real** — not a placeholder. `app/api/v1/endpoints/dashboard.py::_flow_chain` computes exactly the spec's formula shape at the **whole-canal** granularity:

```
expected_loss = 8% × received          (EXPECTED_LOSS_FRACTION, allocation.py)
unaccounted   = received − delivered − expected_loss
alert         = unaccounted > 15% × received   (UNACCOUNTED_ALERT_FRACTION)
```

This is real, tested, and drives the dam dashboard's "Needs Investigation" flag today. What's missing is the spec's *sequential, per-segment* version — localizing the loss to a specific canal section requires multiple measurement points along one canal, and today there is exactly one `current_flow` reading per canal. The `SensorReading` model already has a `location` field ready to support that once more than one measurement point per canal is entered.

## 14. Final System Response Table

| Step | Status |
|---|---|
| 1. Observe / validate inputs | ✅ for requests (past-date rejection, quantity/duration bounds) and sensor readings (🔧 this pass); ❌ no equivalent validation exists for canal-level dam-operator updates beyond audit logging. |
| 2. Detect shortage/conflict, classify | ✅ `detect_shortage`, `Conflict` lifecycle. |
| 3. Generate + validate allocation | ✅ `allocate()` — every constraint is checked in code (asserted, not just hoped for — see the `raise ValueError` invariant checks in `allocation.py`). |
| 4. Receive objection, negotiate | ✅, plus 🔧 the new escalation-after-3 limit. |
| 5. Monitor actual delivery | ✅ `Delivery` model + Jal Vigyani views. |
| 6. Escalate unresolved/enforcement case | ✅ manual (`decide_conflict`) and 🔧 now automatic too. |

---

## Summary

Of the ~80 individual cases: roughly **30 are genuinely implemented and verified**, **~15 are partial** (the mechanism exists but doesn't cover the full case), **3 concrete gaps were fixed in this pass** (sensor validation, objection-loop escalation, and the mediation-agent LLM timeout that was causing the "sometimes slow" symptom), and the remainder — concentrated almost entirely in **§3 (theft/gate/tamper detection)** and **§9 (IoT hardware failure modes)** — are honestly not implemented because they require physical sensor infrastructure (outlet meters, gate-position sensors, multiple sequential flow-measurement points per canal, device heartbeats) that this prototype does not have and should not fake. The data model (`SensorReading.location`, `Anomaly`) is already shaped to receive that data later without a schema change.

**All fixes in this pass are tested**: 82/82 backend tests pass (was 74; +7 sensor validation, +1 escalation), frontend `tsc`/`vite build` clean.

## Performance: the "sometimes slow" symptom

Found and fixed two real, unbounded-network-call causes beyond the query-batching work from the previous pass — both in code that runs **synchronously inside a user-facing request**:

1. `app/services/mediation_agent.py`'s `ChatAnthropic` call, made inside every `POST /mediation/objections`. No timeout was configured — the LangChain/SDK default is 10 minutes, retried. Now bounded to `timeout=15, max_retries=1`.
2. `app/services/llm_client.py`'s raw `anthropic.Anthropic()` / `openai.OpenAI()` clients, used by the AI Coordinator (website chat + Twilio) for **every** chat turn. Same missing timeout, same 10-minute-times-retries exposure. Now bounded to `timeout=20, max_retries=1`.

Both were already designed to *degrade* gracefully on failure (fall back to deterministic text / a "not configured" reply) — they just weren't bounded in *time*, so a slow or momentarily unresponsive provider could stall a request for minutes instead of failing fast.

**This was not theoretical** — running the full backend test suite after fixing #1 took **20 minutes instead of the usual 25 seconds**. The actual root cause: `tests/test_allocation_engine_edge_cases.py` exercises the objection flow without mocking the mediation agent, so it was making a **real, network-dependent call to Anthropic on every test run** — silently, since it usually completed in a couple of seconds and nobody noticed until a provider hiccup triggered the unbounded retry path. Fixed at the source: `tests/conftest.py` now clears both provider API keys for every test, autouse, so the entire suite is structurally incapable of making a real LLM call regardless of which test file runs next. Verified: **82/82 tests pass in 23s**, down from 1226s.
