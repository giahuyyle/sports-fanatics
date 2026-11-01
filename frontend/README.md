# Sports Fanatics frontend

React, TypeScript, and Vite implementation of the supplied Sports Fanatics prototype.

## Run locally

Start the API from `backend/` with its configured database and existing virtual environment:

```sh
.venv/bin/uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Then start the frontend from this folder:

```sh
npm install
npm run dev
```

Vite proxies `/api` to `http://127.0.0.1:8000`. For production, serve the frontend and `/api` behind the same origin. Alternatively, set `VITE_API_BASE_URL` to the API's full `/api/v1` URL at build time; cross-origin deployments must configure the API's allowed origins separately.

## Gameplay and data

Routes: `/`, `/game`, `/game/tic-tac-toe`, `/game/guess-player`, `/fantasy`, `/locker`.

The catalog and answer validation use the live API. Draft positions, team labels, and rankings are curated prototype enrichment and explicitly labeled demo data. Missing imported players are excluded and reported. Grid validation requires recorded NBA appearances with positive games played for both teams, excluding aggregate rows. Each new grid randomly selects six distinct teams and checks that all nine intersections can be filled using nine distinct imported players. The layout is saved with the game and survives refresh. New game requests a fresh layout; insufficient history produces a retryable message. Team headers use bundled SVG components from `mf-react-basketball-logos`, a React 19-compatible fork of `react-nba-logos`. Existing saves from the fixed-grid version reset only that grid, preserving locker progress and other games.

Game state, league setup, draft picks, and progress are saved on this device under `sf-state-v1`. Completion is counted once; these device saves are independent of signed-in accounts, and there is no remote multiplayer. Storage failures allow continued in-memory play. Corrupt or incompatible saved state resets safely.

The API must be available to load the catalog and validate answers. The UI preserves entered answers after request failures and offers retry; it does not fall back to mock data.

## Checks

```sh
npm run build
npm run lint
npm test
```

Backend endpoint checks, from `backend/`:

```sh
.venv/bin/python -m unittest discover -s tests -v
```

## Firebase accounts

Use Node.js 24.12 or newer for the Firebase 13 SDK dependency.

Copy `.env.example` to `.env.local` and fill in your Firebase web app configuration, preserving any existing settings. Restart Vite after changing environment files. Enable Email/Password and Google in Firebase Authentication; add `localhost` and your deployed hostname to Authentication → Settings → Authorized domains. Configure your Firebase password policy and verification/password-reset email templates in the console.

Routes `/login`, `/signup`, and `/forgot-password` support email/password, Google popup sign-in, and reset emails. `/account` requires sign-in and synchronizes the user with the API before showing account data. Sessions persist until sign-out. Password signups receive a verification email; account access is allowed before verification, with resend and refresh controls on the account page. Firebase configuration values are public browser settings; service-account keys belong only on the backend.

`/locker` remains device-only. Signing in or out does not import, erase, or transfer device progress. Game history, league membership, profile editing, account deletion, and custom provider linking are outside this release.

Manual acceptance: verify email signup, verification/resend, Google sign-in, reset email, reload persistence, logout, protected-route return, sync failure/retry, and guest gameplay. Verify the user in Firebase Authentication and confirm repeated sign-ins reuse one SQL account. These checks require a configured development Firebase project; automated backend checks mock Firebase.
