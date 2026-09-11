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
   { "role": "jal_vigyani" }
   { "role": "dam_operator" }
   ```

How it works:

- Frontend: `ClerkProvider` + `/sign-in` and `/sign-up` routes. `RequireRole`
  guards `/app/farmer`, `/app/jal-vigyani`, `/app/dam` — signed-out users go
  to sign-in, wrong/missing roles go to `/no-access`.
- Backend: `app/core/auth.py` verifies the Clerk session token (official
  `clerk-backend-api` SDK) and reads the role from the user's public metadata
  (60s cache). `GET /api/v1/me` returns `{user_id, role}`; guards
  (`require_farmer`, `require_jal_vigyani`, `require_dam_operator`) return
  401 when signed out, 403 for the wrong role, 503 when `CLERK_SECRET_KEY`
  is not configured.

## Health checks

| Method | URL                        | Description            |
| ------ | -------------------------- | ---------------------- |
| GET    | `http://localhost:8000/`   | Service root           |
| GET    | `http://localhost:8000/health` | Liveness probe     |
| GET    | `http://localhost:8000/api/v1/health` | Versioned health check |

Interactive API docs: http://localhost:8000/docs
