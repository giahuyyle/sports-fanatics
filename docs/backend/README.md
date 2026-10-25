# NBA backend operations

The backend provides authenticated NBA catalog, team, private-league, draft,
lineup and admin services. Existing gameplay pages still use the local prototype.
Only `/#/admin` connects to these services in this release.

## Local setup with Docker Compose

One root `compose.yaml` runs PostgreSQL, a one-shot Alembic migration, FastAPI,
the independent timeout worker, and Vite. The API and worker share one backend
image. Migration waits for a healthy database; API/worker wait for successful
migration; frontend waits for API readiness. The optional `emulator` profile adds
Firebase Auth locally.

For your real Firebase project, follow the [Firebase setup guide](FIREBASE.md),
fill the root `.env`, and place the server credential in `.secrets/`. Then run:

```sh
docker compose up --build
```

- App/admin: http://localhost:5173/#/admin
- API docs: http://localhost:8000/docs
- Process/database health: `/api/health`, `/api/ready`
- Status: `docker compose ps -a`
- Logs: `docker compose logs -f api worker`
- Stop: `docker compose down` (keeps database and emulator data volumes)

The API reloads mounted Python sources; Vite hot-reloads mounted frontend sources.
Restart the worker with `docker compose restart worker` after changing worker or
domain code; it does not run a file watcher.
Dependencies live inside the images/container volumes, independent of host Python
and Node installations. After changing dependency lockfiles, rebuild the stack.
After adding migrations while running, stop API/worker, run
`docker compose run --rm migrate`, then start API/worker again. Avoid schema
changes while the worker or API is writing.

This development setup binds ports to the host loopback interface. Override
`DATABASE_PORT`, `API_PORT`, `FRONTEND_PORT`, `AUTH_PORT` in root `.env` for conflicts.
Inside Docker, service names (`db`, `api`, `auth`) are used instead of localhost.
The browser continues to use localhost; Vite proxies `/api` and its event stream.

The migration job normally exits with code 0; this is expected, not a failed
service. `docker compose down` preserves data. `down --volumes` deletes local data;
use it only for an intentional reset.

For emulator setup and admin grants, see [Firebase setup](FIREBASE.md).

## Native development alternative

Keep the Compose-managed database, but stop the container API/worker/frontend
before starting native processes on the same ports. Set native backend/frontend
`.env` files using their own `.env.example` files. Backend `DATABASE_URL` uses
`localhost` and the published database port; frontend `API_PROXY_TARGET` uses the
host API address. For real Firebase, unset the backend emulator host, clear the
frontend emulator URL, set matching project/web identifiers, and point
`GOOGLE_APPLICATION_CREDENTIALS` to your server credential's absolute host path.

Run `uv sync`, `uv run alembic upgrade head`, `uv run uvicorn app.main:app --reload`,
and `uv run python -m app.jobs.worker` from `backend/`. Run `npm ci` and
`npm run dev` from `frontend/`. Root `.env` is only for Compose; native tools use
their own subdirectory environment files.

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
