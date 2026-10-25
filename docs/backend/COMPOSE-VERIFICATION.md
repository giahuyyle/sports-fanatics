# Compose verification — 25 October 2026

Validated the single root Compose configuration in both default cloud mode and
optional emulator mode. The default uses public Firebase identifiers from root
`.env`; credentials are mounted read-only into the API only and are excluded
from Docker build contexts and Git. Native-dev emulator variables are overridden.

Verified in isolated project `sports-fanatics-compose-qa`, using separate database,
API, frontend and Auth ports to preserve the existing developer database:

- Backend, frontend, and Auth emulator Docker images build successfully.
- `up --wait` succeeds: database healthy, migration exits 0, API/frontend/Auth
  healthy, and the independent worker remains running.
- Frontend `/api` proxy reaches API readiness and authenticated routes.
- Operator admin grant runs successfully inside the API container.
- Emulator stop/start exports/imports its users and preserves the same UID.
- Frontend lint, 10 unit tests, and production build pass inside the Linux image
  and on the host.
- Chrome admin tests pass against the containerized services: sign-in, edits,
  invalid/valid imports, publication, mobile widths and ordinary-user denial.
- Real-project provider/domain configuration was checked read-only; the real
  Firebase Admin SDK was also checked from the container without displaying
  credential contents or creating a Firebase user.

Test services are shut down afterward. Real-project interactive sign-in and the
first local administrator grant are performed by the developer using the
[Firebase setup guide](FIREBASE.md).
