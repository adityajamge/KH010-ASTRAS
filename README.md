# JalSetu

Monorepo with two separate applications. No features built yet — development setup only.

```
JalSetu/
  frontend/   # Vite + React + TypeScript (http://localhost:5173)
  backend/    # Python + FastAPI (http://localhost:8000)
```

## Quickstart

Backend:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Health checks: `GET /health`, `GET /api/v1/health`. Docs: http://localhost:8000/docs
