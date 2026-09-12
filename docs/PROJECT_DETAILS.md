# JalSetu — Project Details

**PS14: Autonomous Water-Sharing Dispute Mediation Agent for Farmers.**
An agentic platform that helps farmers and water-user groups resolve disputes
over limited irrigation water — not a chatbot, but a negotiation workflow
backed by a deterministic allocation/constraint engine, with an LLM layer
for language, mediation and explanation on top of it.

This document describes the system **as it actually exists in the
repository today** (verified against the code, not aspirational). See
`docs/PS14_Water_Sharing_Mediation_Agent.md` for the original problem-
statement spec this implementation is built against.

---

## 1. Architecture

```
Farmer / Jal Vigyani / Dam Operator
          │  (website chat)              │ (WhatsApp/SMS)
          ▼                              ▼
   POST /api/v1/assistant/message   POST /api/v1/twilio/inbound
          │                              │
          └──────────────┬───────────────┘
                          ▼
              app.services.ai_coordinator
              (LLM tool-calling loop — Anthropic or OpenAI)
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
  Deterministic     Deterministic      LLM Mediation Agent
  Allocation Engine  Mediation/         (writes the negotiation
  (app/services/     Conflict Workflow   reply on objections —
  allocation.py)     (app/services/      never decides numbers)
                      mediation.py)
                          │
                          ▼
              Postgres (Neon) — farmers, canals, requests,
              allocations, deliveries, schedules, conflicts,
              objections, agreements, audit log, chat log
                          │
                          ▼
              GET /api/v1/network/state
                          │
                          ▼
              3D Digital Twin (Three.js / React Three Fiber)
```

**Guiding principle (from the spec, enforced in code):** the LLM is the
orchestrator and communication layer. It never computes an allocation,
schedule, or evidence line — every number it states comes from a tool
result, which in turn comes from the deterministic engine. Twilio and the
website chat call the *exact same* `ai_coordinator.handle_message()`
function — there is no separate business logic per channel.

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Backend | FastAPI (Python), SQLAlchemy 2.0, Alembic migrations |
| Database | PostgreSQL (Neon, serverless) |
| Auth | Clerk (roles + `dam_id` via `publicMetadata`) |
| AI Coordinator | Anthropic Claude or OpenAI — provider-agnostic (`LLM_PROVIDER` env var) |
| Mediation "voice" | LangChain + `ChatAnthropic` (Claude Haiku 4.5) |
| Messaging channel | Twilio (WhatsApp sandbox / SMS) |
| Frontend | React + TypeScript + Vite |
| 3D Digital Twin | Three.js via `@react-three/fiber` + `@react-three/drei` |
| i18n | Custom context (`lib/i18n.tsx`) — English / Hindi / Marathi |
| Testing | pytest (backend, 74 tests), `tsc`/`oxlint` (frontend) |

---

## 3. Repository layout

```
backend/
  app/
    api/v1/endpoints/   # one file per resource — see §7
    core/                # config.py (env settings), auth.py (Clerk)
    db/                  # session.py, base.py
    models/              # SQLAlchemy ORM — see §6
    schemas/              # Pydantic request/response shapes
    services/             # deterministic engine + AI coordinator — see §5
  alembic/versions/       # migrations
  tests/                  # 74 tests
frontend/
  src/
    pages/dashboards/     # Farmer.tsx, DamOperator.tsx, JalVigyani.tsx
    components/           # DashboardShell, AssistantChat, twin/*
    lib/                  # api.ts (typed fetch client), i18n.tsx, format.ts
docs/                     # this file + the original spec + setup guide
```

---

## 4. Roles and what each can do

Role and `dam_id` (for Jal Vigyani/Dam Operator) live in Clerk
`publicMetadata`, verified server-side on every request (`app/core/auth.py`).

### Farmer
- Onboard (name, phone, canal, first field/crop) — one-time gate.
- Dashboard: available/allocated/remaining water, current allocation,
  today's schedule (interactive time-axis chart with live "now" marker),
  delivery progress, canal live status, recent activity.
- Submit a water request → triggers an immediate allocation cycle.
- Object to a proposal (with a reason + free-text details) → priority is
  boosted one level and the engine recalculates; the LLM mediation agent
  writes a grounded, farmer-facing explanation of the new numbers.
- Accept a proposal → freezes a versioned `Agreement`.
- View the 3D Digital Twin of their dam/canal/farm network.
- Chat (website or WhatsApp/SMS via Twilio) — the AI Coordinator can read
  their live status and act (submit/object/accept) via tool calls.

### Jal Vigyani (canal authority / community hydrologist)
- Dam-scoped overview: canals, farmer count, active conflicts/anomalies.
- Assign/reassign a farmer to a canal.
- Record flow/water-level sensor readings (manual entry, JV-US-02).
- Report an infrastructure/water-loss anomaly (JV-US-03) and track its
  investigation status.
- Review conflicts: participants, objections (with the mediator's
  explanation attached), and decide — Approve / Request revision /
  Escalate — logged to the audit trail.
- View farmer allocations, under-delivery cases, canal-wide schedule.
- Chat with 9 tools (overview, farmer allocations, under-delivery,
  schedule, farmer assignment, conflict list/detail/decision).

### Dam Operator
- Reservoir stats (level, storage, inflow/outflow, status), canal-wise
  release accounting with status filters, rainfall/forecast.
- Publish supply-state updates (storage, inflow, outflow, level, rainfall)
  — propagates to every dashboard immediately.
- View the 3D Digital Twin.
- Chat with 3 tools (overview, dam details, publish supply state).

All three roles share the same "Digital Twin" 3D view of the dam → canal →
farms network, colored by live status (normal / shortage / conflict /
pending mediation / approved / delivery issue).

---

## 5. Backend services (the actual logic)

| Module | Responsibility |
|---|---|
| `services/allocation.py` | Pure deterministic engine: priority weights, 50% minimum-fair-share floors, proportional splitting under shortage, hard caps (never over-allocate or over-promise), water-balance invariant, schedule slot planning. No DB, no LLM. |
| `services/mediation.py` | Persists allocation cycles, conflict detection/sync, objection recording (boosts urgency, reruns the engine), agreement acceptance (versioned, immutable), audit logging, notifications. |
| `services/mediation_agent.py` | LLM-only "voice": given the engine's already-decided numbers + evidence, writes a grounded 3-5 sentence negotiation reply addressing the farmer's specific objection. Returns `None` on any failure — the deterministic `build_reason` text is always the fallback; a mediation reply is a nice-to-have, never a dependency. |
| `services/ai_coordinator.py` | The agent loop shared by website chat and Twilio. Builds a role-specific system prompt + tool list, runs the tool-calling loop (max 6 iterations), logs every turn to `assistant_messages`. |
| `services/llm_client.py` | Normalizes Anthropic's and OpenAI's different tool-calling wire formats into one interface. |
| `services/twilio_client.py` | Inbound signature validation (correctly handles being behind ngrok/a reverse proxy — trusts `X-Forwarded-Proto`/`X-Forwarded-Host`) and outbound WhatsApp send. |
| `services/network_state.py` | Composes the dashboard/Jal-Vigyani/conflict/monitoring services into one shape for the 3D twin. Cached 5s per dam (invalidated immediately on any allocation-cycle mutation) since each DB round trip costs ~300-500ms — see §9. |

---

## 6. Database schema

| Table | Purpose |
|---|---|
| `villages`, `dams`, `canals` | Physical hierarchy. One seeded dam ("Rampur Dam") with 11 canals for the prototype. |
| `farmers`, `fields` | Farmer profile (linked to Clerk via `clerk_user_id`) + their field(s)/crop(s). |
| `water_requests` | A farmer's requirement for a date/time/crop/urgency. |
| `allocations` | Engine output per request — quantity, time slot, status, glass-box `reason` text. |
| `deliveries` | Actual vs. allocated, for under/over-delivery detection. |
| `schedules` | Sequential, non-overlapping time slots per canal/date. |
| `conflicts`, `conflict_participants`, `objections` | Conflict lifecycle: detected → negotiation → approved/escalated/resolved. Objections carry the LLM's `mediator_message`. |
| `agreements` | Versioned, immutable snapshot once a farmer accepts — `supersedes_id` chains prior versions. |
| `sensor_readings`, `anomalies` | Manually-recorded flow/level readings and reported infrastructure issues (no live IoT in this prototype — see §10). |
| `notifications`, `audit_logs` | Farmer-facing notices; append-only system-wide event log. |
| `assistant_messages` | Every chat turn, website or Twilio, keyed by Clerk user id and channel — one unified audit trail regardless of which surface a farmer used. |

Migrations are in `backend/alembic/versions/`; run `alembic upgrade head`
after pulling.

---

## 7. API surface (`/api/v1/...`)

| Router | Endpoints |
|---|---|
| `me` | `GET /me` — current user's role + dam_id |
| `farmers` | onboarding, own profile |
| `canals`, `dams` | reference data |
| `requests` | `POST /requests` — submit a water requirement |
| `dashboard` | `GET /dashboard/farmer`, `GET /dashboard/dam` |
| `mediation` | `GET /mediation/me`, `POST /mediation/objections`, `POST /mediation/accept` |
| `jal_vigyani` | overview, farmer-allocations, under-delivery, schedule, farmers (assign canal) |
| `monitoring` | sensor-readings, anomalies |
| `conflicts` | list, detail, decision (approve/revise/escalate) |
| `assistant` | `POST /assistant/message`, `GET /assistant/history` — website chat |
| `twilio_webhook` | `POST /twilio/inbound` — WhatsApp/SMS, same coordinator |
| `network` | `GET /network/state` — 3D digital twin feed |

Interactive docs at `http://localhost:8000/docs` when the server is running.

---

## 8. AI Coordinator — tool inventory

The coordinator never answers a factual question from memory; the system
prompt requires calling the relevant tool first. Tool list by role:

- **Farmer (4):** `get_status`, `submit_water_request`,
  `object_to_allocation`, `accept_proposal`.
- **Jal Vigyani (9):** `get_overview`, `list_farmer_allocations`,
  `list_under_delivery_cases`, `get_canal_schedule`,
  `list_assignable_farmers`, `assign_farmer_canal`, `list_conflicts`,
  `get_conflict_detail`, `decide_conflict`.
- **Dam Operator (3):** `get_overview`, `get_dam_details`,
  `publish_supply_state`.

Every tool call and its error/success status is logged to
`assistant_messages.meta` for audit. The `lang` field on a chat message
(driven by the dashboard's language dropdown) forces the reply language
regardless of what language the user typed in.

---

## 9. Performance notes

- Each round trip to the Neon database measured at **~300-500ms** — this is
  network latency, not query cost (verified: a trivial `SELECT 1` on an
  already-open connection costs the same). The practical fix is minimizing
  round trips, not query complexity.
- `dashboard.dam_summary`, `jal_vigyani.get_farmer_allocations`, and
  `network_state.build_network_state` were rewritten from O(n) queries
  (one per canal / one per farmer) to a fixed small number of batched
  `GROUP BY` aggregate queries. Measured: the digital twin's feed went from
  **18.87s / 62 queries → ~6.4s / 16 queries** on real data.
  Correctness is covered by the same 74-test suite before and after.
- `network_state` additionally keeps a 5-second in-process cache per dam
  (protects concurrent viewers of the same dam from each re-paying the
  round-trip cost) and is invalidated immediately by
  `run_allocation_cycle` so a farmer's own action is never shown stale.
- `Logging.basicConfig` is set in `app/main.py` — without it, uvicorn does
  not surface application-level `logger.exception(...)` calls to the
  console, which made backend errors invisible during development.

---

## 10. Known limitations (stated, not hidden)

Per the project's own principle ("do not fabricate sensor or water data"):

- **No live IoT/sensor hardware.** `sensor_readings` and `anomalies` are
  manually entered by a Jal Vigyani, not streamed from real flow meters or
  gate-position sensors. Water-theft/tamper/leak detection described in
  the extended edge-case spec (upstream/downstream sequential measurement,
  gate-position cross-checks, sensor tamper/heartbeat monitoring) is
  **not implemented** — it requires physical infrastructure this prototype
  doesn't have.
- **No automatic ML anomaly detection.** Anomalies are human-reported, not
  statistically inferred from historical patterns.
- **Twilio requires a real account + a public tunnel (ngrok) to test** —
  the webhook, signature validation, and shared-coordinator wiring are
  implemented and unit-tested, but an end-to-end WhatsApp round-trip needs
  live credentials neither committed nor available to this session.
- **The digital twin's farmer/canal layout is a rendering convenience**
  (head/middle/tail derived from database insertion order along a canal),
  not a measured physical distance.
- **i18n coverage is partial** — new UI strings fall back to English until
  a Hindi/Marathi translation is added to `lib/translations.ts`; this is
  graceful (never breaks), just incomplete.
- A detailed line-by-line audit against the extended "loopholes & edge
  cases" specification (water theft, sensor tampering, no-feasible-solution
  negotiation, etc.) was requested but not yet completed — most items
  either depend on the missing IoT layer above, or would need a fresh,
  focused pass to verify individually against the current code.

---

## 11. Testing

Backend: `cd backend && pytest -q` — 74 tests covering the allocation
engine's edge cases (shortage, floors, proportional splits, caps), the
mediation/objection/agreement lifecycle, the AI coordinator's tool loop
(with a scripted fake LLM client, no network needed), Twilio signature
validation (including the ngrok reverse-proxy scenario), and the digital
twin's query batching/caching.

Frontend: `npm run build` (runs `tsc -b` then `vite build`) and
`npm run lint` (oxlint).

---

## 12. Running locally

See `docs/setup.md` for full details (env vars, Clerk setup, Twilio/ngrok).
Quick version:

```bash
# Backend
cd backend
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env   # fill in DATABASE_URL, CLERK_SECRET_KEY, ANTHROPIC_API_KEY, ...
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev   # http://localhost:5173
```

---

## 13. Current working-tree state (as of this document)

At the time of writing, the following files have **uncommitted** local
changes on top of the latest commit (`7b076c0`) — the performance-batching
work in §9 and the dashboard structural/interactivity passes on all three
role dashboards:

```
backend/app/api/v1/endpoints/{conflicts,dashboard,jal_vigyani,monitoring}.py
backend/app/services/{ai_coordinator,mediation,network_state}.py
backend/requirements.txt, backend/tests/{conftest.py (new),test_network_state.py}
frontend/src/App.css
frontend/src/components/twin/DigitalTwin3D.tsx
frontend/src/pages/dashboards/{DamOperator,Farmer,JalVigyani}.tsx
```

All of it is covered by the passing test suite (74/74) and clean
`tsc`/`oxlint` runs, but it has not been committed — worth doing before it
risks getting lost or conflicting with further upstream changes.
