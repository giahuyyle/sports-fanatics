# NBA backend verification — 25 October 2026

Implemented checkpoints M1–M7. No production deployment was performed.

## Automated checks

- Backend: **23 tests passed** against isolated PostgreSQL and Firebase Auth emulator.
  Includes actual Firebase tokens, expired/disabled-account rejection, global-name
  races, import atomicity/repeatability and career gaps, pool immutability,
  league-wide feasibility, complete 2/4/6-manager drafts, pick races/idempotency,
  lineup swaps, timeout fallback, pause/resume and persisted replay.
- Backend Ruff lint and format checks passed.
- Alembic: fresh database upgrade to `0005`, metadata comparison (`alembic check`),
  full downgrade to base and re-upgrade passed.
- Frontend: ESLint, Prettier, **10 unit tests**, and TypeScript/Vite production
  build passed.
- Chrome: **15 connected browser tests passed**; the mutually exclusive missing-
  configuration test was skipped in that run and passed separately without
  Firebase configuration. Admin tests use real Auth emulator and FastAPI,
  covering player edits, failed/successful imports, publication, ordinary-user
  denial, and 1440/768/375/320px layout checks. Existing gameplay regression tests
  remain intact.
- Dependency audit after pinning the Node 22-compatible Firebase release and
  updating its gRPC dependency reported zero vulnerabilities.

Screenshots were written under `/private/tmp/sports-fanatics-qa/` and visually
inspected. Temporary servers are shut down after verification.

## Release dependencies

Supply production Firebase configuration and credentials, provision PostgreSQL,
apply migrations, run the timeout worker, and import complete real career data.
Synthetic test fixtures are not live statistics. Existing gameplay screens still
use their browser-local prototype; only the admin dashboard is connected here.
See [operations](README.md) and [integration contracts](INTEGRATION.md).
