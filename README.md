# Sports Fanatics

NBA fantasy drafts with friends and an FPL decision assistant.

## Stack

- `frontend/`: React, TypeScript, Tailwind CSS, and Vite.
- `backend/`: Python and FastAPI, managed with uv.

The frontend implements the supplied Sports Fanatics design as a local interactive
prototype: public landing, NBA leagues, create/join forms, lobbies, a snake draft
room, draft recaps, an illustrative FPL planner, and profile/settings.

League state, queues, picks, preferences, squad edits, and saved plans persist in
browser storage when available. The default sample data includes a live Sunday
League draft and an Office Hoops lobby. Use Settings to clear leagues or restore
samples. Guest managers make simulated picks, and the timer pauses when the draft
page is closed, the tab is hidden, or the demo is offline.

**Service boundary:** gameplay pages remain a browser-local demo with simulated
opponents and sample statistics. The NBA backend now implements Firebase identity,
PostgreSQL persistence, private leagues, atomic snake drafts, authoritative timeout
workers, event replay, and lineup validation. `/#/admin` connects to protected
player/import/pool APIs; gameplay UI integration is the next milestone. FPL remains
illustrative.

Backend setup and deployment: [operations guide](docs/backend/README.md).
API contracts: [integration guide](docs/backend/INTEGRATION.md).
Imports: [formats and synthetic examples](docs/imports/README.md).
Versioned schema diagrams: [database history](docs/database/README.md).

Design references are in `docs/design/`. The original canvas's fonts and styles
were recovered into the frontend; the old prototype build commands in those
reference documents do not apply to this Vite application.

## Prerequisites

- Node.js 22.12+ (Node 22 recommended) and npm.
- Python 3.14 and [uv](https://docs.astral.sh/uv/getting-started/installation/).

## Local development with Docker Compose

Follow the [Firebase setup guide](docs/backend/FIREBASE.md) to connect your project,
configure the root `.env`, and mount your server credential. Then start everything:

```sh
docker compose up --build
```

Open http://localhost:5173/#/admin. PostgreSQL, migrations, API, worker and frontend
run as separate services. The same Compose file provides an optional local Auth
emulator. See [operations](docs/backend/README.md) for profiles, logs and shutdown.

## Native local development

Run these in two terminals from the repository root.

### Backend

```sh
cd backend
uv sync
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Start PostgreSQL, migrate the schema, configure Firebase, and run the timeout
worker as described in the [backend operations guide](docs/backend/README.md).

API: http://127.0.0.1:8000/api/health

Interactive API docs: http://127.0.0.1:8000/docs

### Frontend

```sh
cd frontend
npm ci
npm run dev
```

Open http://localhost:5173. The frontend demo runs independently of the backend.
Hash routes support refresh and deep links, including `/#/nba`, `/#/fpl`, and
`/#/nba/leagues/sunday/draft`. Vite proxies `/api` requests to the backend during
development; the API client helper is retained for future integration.

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
npm run format:check
npm run test
npm run build
npm run test:e2e
```

```sh
cd backend
uv run ruff check .
uv run ruff format --check .
uv run pytest
```

Commit both `frontend/package-lock.json` and `backend/uv.lock` to keep dependency
installs reproducible.

Browser checks use the installed Google Chrome via Playwright (`channel: chrome`).
Install Chrome if necessary, or change the channel in `frontend/playwright.config.ts`
to use a locally installed Playwright browser. Browser tests cover league setup,
join errors and creator restrictions, snake turns, queues, automatic picks,
connection simulation, persistence, FPL comparisons, settings, deep links, and
320/375/768/1440px layouts. Screenshots are written to
`/private/tmp/sports-fanatics-qa/` and are not committed.

## Frontend structure

- `src/components/`: app shell, player carousel, shared UI primitives.
- `src/pages/`: landing, leagues/setup/lobby, draft/recap, FPL, settings.
- `src/state/`: sample data, typed state, persistence, routing, pure draft/FPL logic.
- `src/styles/reference.css`: original canvas styling; `app.css`: application refinements.
- `public/assets/`: local fonts and NBA reference headshots, with credits/licenses.

NBA images remain copyrighted. Their sources and rights notes are recorded in
`frontend/public/assets/players/credits.json`; no commercial redistribution rights
are asserted. Fonts include their SIL Open Font License files.
