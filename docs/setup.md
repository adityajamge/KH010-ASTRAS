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

Run tests: `pytest -q` (from `backend/`).

## Frontend (Vite + React + TS, http://localhost:5173)

```bash
cd frontend
npm install
npm run dev
```

Key env vars (see `frontend/.env.example`):

| Variable       | Default                 |
| -------------- | ----------------------- |
| `VITE_API_URL` | `http://localhost:8000` |

## Health checks

| Method | URL                        | Description            |
| ------ | -------------------------- | ---------------------- |
| GET    | `http://localhost:8000/`   | Service root           |
| GET    | `http://localhost:8000/health` | Liveness probe     |
| GET    | `http://localhost:8000/api/v1/health` | Versioned health check |

Interactive API docs: http://localhost:8000/docs
