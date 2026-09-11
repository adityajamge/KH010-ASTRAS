# JalSetu Frontend (Vite + React + TypeScript)

## Setup

```bash
cd frontend
npm install
cp .env.example .env.development
npm run dev        # http://localhost:5173
```

## Environment variables

| Variable       | Example                   | Description              |
| -------------- | ------------------------- | ------------------------ |
| `VITE_API_URL` | `http://localhost:8000`   | Backend base URL         |
| `VITE_APP_NAME`| `JalSetu`                 | Display name (optional)  |

## Scripts

| Command           | Description              |
| ----------------- | ------------------------ |
| `npm run dev`     | Start dev server (:5173) |
| `npm run build`   | Type-check + build       |
| `npm run preview` | Preview production build |
| `npm run lint`    | Lint with oxlint         |

## Structure

```
frontend/
  src/
    lib/api.ts       # Typed backend client (health checks)
    App.tsx          # Setup placeholder + backend status
    main.tsx         # React entry point
  .env.example
  .env.development
  vite.config.ts
```
