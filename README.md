# Sports Fanatics

NBA fantasy drafts with friends and an FPL decision assistant.

## Stack

- `frontend/`: React, TypeScript, Tailwind CSS, and Vite.
- `backend/`: Python and FastAPI, managed with uv.

The initial scaffold includes a placeholder home screen and a working API health
check. League management, drafting, FPL predictions, authentication, and database
integration will be added separately.

## Prerequisites

- Node.js 22.12+ (Node 22 recommended) and npm.
- Python 3.14 and [uv](https://docs.astral.sh/uv/getting-started/installation/).

## Local development

Run these in two terminals from the repository root.

### Backend

```sh
cd backend
uv sync
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

API: http://127.0.0.1:8000/api/health

Interactive API docs: http://127.0.0.1:8000/docs

### Frontend

```sh
cd frontend
npm ci
npm run dev
```

Open http://localhost:5173. The page reports whether the API is connected.
Vite proxies `/api` requests to the backend during development.

Configuration works out of the box. To override it, copy the relevant
`.env.example` file to `.env` in its own directory and edit the values.
Never put secrets in `VITE_` variables, which are included in the browser bundle.

For deployment, either route `/api` to FastAPI on the frontend's origin or set
`VITE_API_BASE_URL` before building and configure backend `CORS_ORIGINS` to allow
the frontend origin. The Vite development proxy is not part of production builds.

## Checks

```sh
cd frontend
npm run lint
npm run build
```

```sh
cd backend
uv run ruff check .
uv run ruff format --check .
uv run pytest
```

Commit both `frontend/package-lock.json` and `backend/uv.lock` to keep dependency
installs reproducible.
