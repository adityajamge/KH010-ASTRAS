# Local Development Setup

## Prerequisites

- Node.js 22+ (`node --version`)
- Python 3.10+ (`python --version`)

## Backend (FastAPI, http://localhost:8000)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
copy .env.example .env        # Windows
# cp .env.example .env        # macOS/Linux
uvicorn app.main:app --reload --port 8000
```

Key env vars (see `backend/.env.example`):

| Variable               | Default                   |
| ---------------------- | ------------------------- |
| `ENVIRONMENT`          | `development`             |
| `PORT`                 | `8000`                    |
| `API_V1_PREFIX`        | `/api/v1`                 |
| `BACKEND_CORS_ORIGINS` | `http://localhost:5173`   |
| `DATABASE_URL`         | _(required for DB-backed endpoints)_ |

Run tests: `pytest -q` (from `backend/`).

## Database (Neon Postgres)

1. Create a project at https://console.neon.tech and copy the **direct**
   (non-pooled) connection string.
2. Set it as `DATABASE_URL` in `backend/.env`:
   ```text
   DATABASE_URL=postgresql+psycopg://<user>:<password>@<host>/<dbname>?sslmode=require
   ```
3. Generate and apply the initial migration:
   ```bash
   cd backend
   alembic revision --autogenerate -m "initial schema"
   alembic upgrade head
   ```

Models live in `app/models/` (one file per domain: `farmer`, `network`,
`request`, `conflict`, `monitoring`, `system`, plus shared `enums.py`),
matching Pydantic read/create schemas in `app/schemas/`. `app/db/session.py`
exposes a `get_db()` FastAPI dependency for a request-scoped
`sqlalchemy.orm.Session`.

Whenever models change, regenerate a migration with
`alembic revision --autogenerate -m "<description>"` and review the
generated file before running `alembic upgrade head`.

## Frontend (Vite + React + TS, http://localhost:5173)

```bash
cd frontend
npm install
npm run dev
```

Key env vars (see `frontend/.env.example`):

| Variable                      | Default                 |
| ----------------------------- | ----------------------- |
| `VITE_API_URL`                | `http://localhost:8000` |
| `VITE_CLERK_PUBLISHABLE_KEY`  | _(required for auth)_   |

## Authentication (Clerk)

1. Create an application at https://dashboard.clerk.com (accept defaults).
2. Copy the **publishable key** into `frontend/.env.development` as
   `VITE_CLERK_PUBLISHABLE_KEY`, and the **secret key** into `backend/.env`
   as `CLERK_SECRET_KEY`. Restart both servers.
3. Assign each user a role: Dashboard → Users → select user → Metadata →
   edit **Public metadata** to one of:
   ```json
   { "role": "farmer" }
   { "role": "jal_vigyani", "dam_id": 1 }
   { "role": "dam_operator", "dam_id": 1 }
   ```
   `dam_operator` and `jal_vigyani` also need `dam_id` — the shared dam
   (see `dams` table) they're assigned to. For this hackathon there is a
   single seeded dam, id `1` ("Rampur Dam"), so both roles use `dam_id: 1`.

How it works:

- Frontend: `ClerkProvider` + `/sign-in` and `/sign-up` routes. `RequireRole`
  guards `/app/farmer`, `/app/jal-vigyani`, `/app/dam` — signed-out users go
  to sign-in, wrong/missing roles go to `/no-access`.
- Backend: `app/core/auth.py` verifies the Clerk session token (official
  `clerk-backend-api` SDK) and reads role + dam_id from the user's public
  metadata (60s cache). `GET /api/v1/me` returns `{user_id, role, dam_id}`;
  guards (`require_farmer`, `require_jal_vigyani`, `require_dam_operator`)
  return 401 when signed out, 403 for the wrong role, 503 when
  `CLERK_SECRET_KEY` is not configured.

## AI Coordinator (website chat + Twilio)

The chat assistant (farmer dashboard chat panel, and the Twilio channel) is
powered by `app/services/ai_coordinator.py` — one agent loop, shared by both
surfaces, that calls the same deterministic services
(`app/services/mediation.py`, `app/services/requests.py`) the REST endpoints
use. It never invents litres or evidence; it only decides which tool to call
and drafts the reply.

1. Pick a provider and set its key in `backend/.env` (see
   `backend/.env.example`):
   ```text
   LLM_PROVIDER=anthropic        # or "openai"
   ANTHROPIC_API_KEY=sk-ant-...
   ANTHROPIC_MODEL=claude-sonnet-5
   ```
   Leaving the selected provider's key empty is fine — the assistant replies
   with a "not connected" notice instead of erroring.
2. Apply the new migration (`assistant_messages` table):
   ```bash
   cd backend
   alembic upgrade head
   ```
3. Website chat: `POST /api/v1/assistant/message` (farmer, Jal Vigyani, or
   dam operator — the same panel calls it for all three) and
   `GET /api/v1/assistant/history`. No frontend env changes needed.

### Twilio channel (WhatsApp/SMS prototype)

Twilio is a transport only — inbound messages are resolved to a farmer by
phone number and handed to the exact same `ai_coordinator.handle_message`
the website chat calls.

1. Create a trial account at https://console.twilio.com and activate the
   WhatsApp sandbox (Messaging → Try it out → Send a WhatsApp message).
2. Set in `backend/.env`:
   ```text
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   TWILIO_WHATSAPP_FROM=whatsapp:+14155238886   # the sandbox number
   ```
3. Point the sandbox's "when a message comes in" webhook at
   `{PUBLIC_API_URL}/api/v1/twilio/inbound` (needs a public HTTPS URL —
   `ngrok http 8000` works for local testing). Set
   `TWILIO_VALIDATE_SIGNATURE=false` only while testing behind a tunnel that
   changes the signed URL; leave `true` in any real deployment.
4. A farmer must complete onboarding on the website with the same phone
   number they message from — the webhook replies with an onboarding prompt
   for unrecognized numbers rather than guessing an identity.

## 3D Digital Twin

`GET /api/v1/network/state` feeds the dam → canal → farms 3D view
(`frontend/src/components/twin/`, nav item "Digital Twin" on all three
dashboards). It composes the same dam/farmer/conflict services the
dashboards already use (`app/services/network_state.py`) — no separate
business logic. `npm install` (already run above) pulls in `three`,
`@react-three/fiber`, and `@react-three/drei`; no extra env vars needed.

## Health checks

| Method | URL                        | Description            |
| ------ | -------------------------- | ---------------------- |
| GET    | `http://localhost:8000/`   | Service root           |
| GET    | `http://localhost:8000/health` | Liveness probe     |
| GET    | `http://localhost:8000/api/v1/health` | Versioned health check |

Interactive API docs: http://localhost:8000/docs
