# NBA backend operations

The backend provides authenticated NBA catalog, team, private-league, draft,
lineup and admin services. Existing gameplay pages still use the local prototype.
Only `/#/admin` connects to these services in this release.

## Local setup

1. From the root, run `docker compose up -d db`.
2. In `backend/`, copy `.env.example` to `.env`, run `uv sync`, then
   `uv run alembic upgrade head`.
3. Start the API with `uv run uvicorn app.main:app --reload`.
4. In another backend terminal, run `uv run python -m app.jobs.worker`.
5. In the repository root, run
   `npx firebase-tools@14.27.0 emulators:start --only auth --project demo-sports-fanatics`.
6. Set backend `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099` and
   `FIREBASE_PROJECT_ID=demo-sports-fanatics` before starting the API.
7. In `frontend/.env`, set `VITE_FIREBASE_PROJECT_ID=demo-sports-fanatics`,
   `VITE_FIREBASE_API_KEY=demo-key`, `VITE_FIREBASE_AUTH_DOMAIN=localhost`, and
   `VITE_FIREBASE_AUTH_EMULATOR_URL=http://127.0.0.1:9099`.
8. Start the frontend with `npm ci` then `npm run dev`.

Create a local email/password account through the Auth emulator REST API:

```sh
curl -X POST 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key' \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.test","password":"local-password-only","returnSecureToken":true}'
```

Sign in at `/#/admin`. The page calls `/api/v1/me` to register the internal user.
Copy the emulator user's `localId` into this operator command, then reload:

```sh
cd backend
uv run python -m app.cli grant-admin FIREBASE_UID
```

Configure players, import their statistics, create a pool, save its player
selection, and publish it. Validation errors are visible in the dashboard and
import reports. The dashboard retains selections across catalog searches; each
search returns up to 200 players.

## Production configuration

- Use managed PostgreSQL and run Alembic migrations before starting API/worker.
- Configure a real Firebase project with Google and email/password enabled,
  authorized browser domains, and matching public frontend configuration.
- Use Application Default Credentials for the server's Firebase Admin SDK.
  Service-account credentials belong only on the server.
- **Unset `FIREBASE_AUTH_EMULATOR_HOST` in production.** The emulator intentionally
  accepts unsigned development tokens. Browser emulator configuration is ignored
  in production builds.
- Set `CORS_ORIGINS` to exact frontend origins. Prefer same-origin `/api` routing.
- The API and worker use the same database. Start at least one worker; multiple
  workers safely skip already-locked expired leagues.
- Configure reverse proxies to disable buffering for SSE and allow long-lived
  connections. Clients reconnect using a fresh Firebase token when necessary.
- `/api/health` checks the process; `/api/ready` checks PostgreSQL connectivity.
  Deployment readiness also requires migrations at head and a running worker.
- Emit `app` logs as JSON. `/api/v1/admin/metrics` contains per-API-process
  counters; workers emit their counters every minute. Aggregate logs/counters in
  the deployment's monitoring system. Alert on worker lag, solver timeouts,
  worker failures and unexpected draft pauses.
- Take database backups before migrations. Stop writers before restoring;
  restore the matching application version and run migrations deliberately.

## Tests

Use a dedicated PostgreSQL database whose name ends in `_test`. Tests truncate
its domain tables, so never point this setting at production data.

```sh
cd backend
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@localhost/fanatics_test uv run alembic upgrade head
TEST_DATABASE_URL=postgresql+psycopg://USER:PASSWORD@localhost/fanatics_test uv run pytest
uv run ruff check .
uv run ruff format --check .
```

Database tests skip without `TEST_DATABASE_URL`; a skipped run does not verify
concurrency. Emulator tests also require `FIREBASE_AUTH_EMULATOR_HOST` and a
matching `FIREBASE_PROJECT_ID`. Backend fixtures are labeled synthetic data.

Frontend checks: `npm run lint`, `npm run test`, `npm run build`, and
`npm run test:e2e`. Emulator browser checks additionally use the variables
documented in `frontend/tests/admin.spec.ts`.

## Delivery checkpoints

- M1: PostgreSQL, migrations, health/readiness, standard errors.
- M2: Firebase identities, global team names, operator admin grants.
- M3: player catalog, career imports, immutable published pools, audit trail.
- M4: exact league-wide roster feasibility and independent witness validation.
- M5: private leagues, locked/idempotent snake picks, queues, lineup replacement.
- M6: deadlines, independent worker, persisted SSE replay, pause/resume, telemetry.
- M7: admin dashboard, setup/import/API documentation and integration guide.

Schema snapshots live in [database history](../database/README.md). The next
product milestone connects the existing gameplay UI; scoring/global leagues,
trades and free agency are deliberately outside this release.
