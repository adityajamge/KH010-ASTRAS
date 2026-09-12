# JalSetu

**PS14 — Autonomous Water-Sharing Dispute Mediation Agent for Farmers.**
An agentic platform for resolving irrigation water disputes: a deterministic
allocation/constraint engine decides every litre, an LLM-driven AI
Coordinator (website chat + WhatsApp/SMS via Twilio) handles language,
negotiation and explanation on top of it, and a 3D digital twin visualizes
the dam → canal → farm network live.

See **[docs/PROJECT_DETAILS.md](docs/PROJECT_DETAILS.md)** for full
architecture, features, database schema, API reference and known
limitations. See **[docs/setup.md](docs/setup.md)** for environment setup
(Clerk, Neon, LLM keys, Twilio/ngrok).

```
JalSetu/
  frontend/   # React + TypeScript + Vite (http://localhost:5173)
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
