# Sports Fanatics API

From this directory, run `uv sync`. Preserve your existing `.env`; use `.env.example` for required settings. Database paths are relative to this directory, and Alembic uses the app's configured database URL.

Before starting an updated API, run `uv run alembic upgrade head`, then `uv run fastapi dev main.py`. The users migration adds a table without changing NBA data. Back up an existing database before migrating it.

## Firebase authentication

Enable Email/Password and Google in Firebase Authentication. Set `FIREBASE_PROJECT_ID` to the same project as the frontend. For local development, set `GOOGLE_APPLICATION_CREDENTIALS` to an absolute path to a service-account JSON file stored outside the repository. Never commit credentials. On Google Cloud, use Application Default Credentials with an appropriately authorized runtime service account.

`POST /api/v1/users/me` verifies a Firebase ID token and idempotently synchronizes the application user. `GET /api/v1/users/me` reads that user (404 before synchronization). Both require `Authorization: Bearer <Firebase ID token>`. Firebase owns credentials and identity fields; the database stores a unique Firebase UID and an internal user ID for future stats and league memberships. Tokens are checked for revocation and disabled accounts. No passwords or tokens are stored in SQL.

Missing/invalid credentials return 401; unavailable account services return 503. Public game routes remain available without Firebase configuration. Keep the API and frontend under the same origin; the Vite development proxy already handles `/api`.

## Verification

Run `uv run python -m unittest discover -s tests -v`. Tests mock Firebase verification and use isolated databases; they never require production credentials or alter the NBA database.
