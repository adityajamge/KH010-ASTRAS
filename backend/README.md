# JalSetu Backend (FastAPI)

## Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
copy .env.example .env        # Windows
# cp .env.example .env        # macOS/Linux
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Endpoints

| Method | Path           | Description       |
| ------ | -------------- | ----------------- |
| GET    | `/`            | Service root      |
| GET    | `/health`      | Liveness probe    |
| GET    | `/api/v1/health` | Versioned health check |

Interactive docs: http://localhost:8000/docs

## Tests

```bash
pytest -q
```

## Structure

```
backend/
  app/
    main.py              # App factory, CORS, routers
    core/config.py       # Env-based settings (pydantic-settings)
    api/v1/router.py     # v1 router aggregation
    api/v1/endpoints/    # Route handlers (health.py, ...)
    schemas/             # Pydantic response/request models
    services/            # Business logic (future)
  tests/                 # Pytest suite
  requirements.txt
  .env.example
```
