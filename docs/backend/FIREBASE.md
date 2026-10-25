# Connect your Firebase project

This app uses Firebase **Authentication**, with PostgreSQL storing the NBA data.
No Firestore database, Realtime Database, Firebase Hosting or Firebase Functions
setup is needed. This guide uses the real project with the development Compose
stack. Its optional emulator is documented separately below.

## 1. Register the browser app

In [Firebase Console](https://console.firebase.google.com/), select your project.
Open **Project settings → General → Your apps**. If there is no Web app, click the
Web (`</>`) button, give it a nickname such as Sports Fanatics Web, and register it.
Firebase Hosting is optional; leave it off for this local setup.

In that app's SDK setup/configuration section, select **Config** and locate:

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  // Other fields are not required by our Auth integration.
};
```

These are public browser identifiers. They are different from the server's
private service-account credentials.

## 2. Enable sign-in methods and localhost

Open **Authentication → Get started** if prompted, then **Sign-in method**.
Enable **Google**, choose a project support email if prompted, and save.
Also enable **Email/Password** (password-based sign-in; email links are not needed).

Under **Authentication → Settings → Authorized domains**, add `localhost` if it
is absent. Use **http://localhost:5173** consistently for local sign-in. An
additional host, such as `127.0.0.1`, must be authorized separately if you use it.
Authorized domains are hostnames, without schemes or port numbers.

Google sign-in creates the Firebase user on first sign-in. For email/password,
create your first account under **Authentication → Users → Add user**. The admin
page currently signs users in; it does not offer account registration.

Provider setup references: [Google sign-in](https://firebase.google.com/docs/auth/web/google-signin)
and [email/password](https://firebase.google.com/docs/auth/web/password-auth).

## 3. Configure the server credential locally

The backend verifies tokens and checks disabled/revoked users through the Firebase
Admin SDK. It needs server credentials for your project.

Open **Project settings → Service accounts → Firebase Admin SDK** and generate a
new private key. Keep the downloaded JSON on your machine. From the repository
root, make the credential directory and copy the downloaded file into it:

```sh
mkdir -p .secrets
cp /absolute/path/to/downloaded-key.json .secrets/firebase-admin.json
chmod 600 .secrets/firebase-admin.json
```

Use your actual downloaded path. Do not paste the JSON/private key into chat or
place it in `frontend/`. `.secrets/` is ignored by Git. Compose mounts this directory
read-only into the **API container only**, outside either Docker build context;
credentials are not copied into images. The API uses
`GOOGLE_APPLICATION_CREDENTIALS=/run/firebase/firebase-admin.json`.

The JSON's `project_id` must match the project ID in the next step. If you prefer
an existing credential directory outside the repo, set `FIREBASE_CREDENTIALS_DIR`
to its absolute path; it must contain `firebase-admin.json`.

For cloud deployment, prefer an attached service identity / Application Default
Credentials appropriate to the hosting platform rather than distributing local
key files. See [Firebase Admin SDK setup](https://firebase.google.com/docs/admin/setup).

## 4. Fill the root Compose environment

From the repository root, copy the example if `.env` does not already exist:

```sh
cp .env.example .env
```

Do not overwrite an existing `.env`. Fill these values from the Web app config:

```dotenv
FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
FIREBASE_WEB_API_KEY=YOUR_PUBLIC_API_KEY
FIREBASE_AUTH_DOMAIN=YOUR_PROJECT_ID.firebaseapp.com
FIREBASE_CREDENTIALS_DIR=./.secrets
FIREBASE_AUTH_EMULATOR_HOST=
FIREBASE_AUTH_EMULATOR_URL=
```

Use the actual `authDomain` from Firebase if it differs from the default above.
The root `.env` is ignored by Git. It configures **Compose**, independently of the
native-development `backend/.env` and `frontend/.env` files. Container environment
values override those files, so previous native emulator settings cannot silently
switch the Compose app away from your real project.

The browser receives the public project ID/key/domain. It never receives the
service-account JSON or a private key. Changing root `.env` requires recreating
the affected containers: rerun `docker compose up --build`.

## 5. Start the full app and grant yourself admin

```sh
docker compose up --build
```

Open [the admin page](http://localhost:5173/#/admin) and sign in with Google or your
Firebase email/password user. Initially, **Administrator access required** is
expected: Firebase identity and this app's administrator role are separate.

Copy your user's UID from **Authentication → Users**. In a second terminal:

```sh
docker compose exec api python -m app.cli grant-admin YOUR_FIREBASE_UID
```

The first admin-page sign-in registers your internal account through `/api/v1/me`;
the operator command requires that registration first. Refresh the browser after
granting access. The grant changes only local PostgreSQL permissions, not Firebase
IAM, project ownership, or custom claims.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Firebase configuration required | Fill `FIREBASE_WEB_API_KEY` and `FIREBASE_PROJECT_ID` in root `.env`, then recreate the frontend container. |
| `auth/unauthorized-domain` | Add `localhost` to Auth authorized domains and use `http://localhost:5173`. |
| `auth/operation-not-allowed` | Enable the corresponding sign-in provider in Firebase Console. |
| Invalid API key / project mismatch | Copy the Web app config from the same project used by the server credential. |
| Browser sign-in succeeds, `/me` fails | Check `docker compose logs api`; verify `.secrets/firebase-admin.json`, its read permissions and its `project_id`. |
| `auth/popup-blocked` | Allow the Google sign-in popup or use email/password. |
| User must sign in first | Visit the admin page and finish sign-in before running `grant-admin`. |
| Admin access required after a grant | Verify the UID, correct Compose project/database, and refresh. |

## Optional: fully local Auth emulator

This uses the **same Compose file** and the `emulator` profile. It never accesses
your real Firebase project. Copy the separate environment example:

```sh
cp compose.emulator.env.example .env.emulator
docker compose --env-file .env.emulator --profile emulator up --build
```

The backend reaches `auth:9099` over Docker networking; the browser reaches
`http://localhost:9099`. The emulator always uses `demo-sports-fanatics`.
Use both the alternate environment file **and** the profile; starting the emulator
profile alone does not change a real-project configuration.

Create a local account using the emulator REST API:

```sh
curl -X POST 'http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key' \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.test","password":"local-password-only","returnSecureToken":true}'
```

Sign in through the admin page, then grant the returned `localId`:

```sh
docker compose --env-file .env.emulator --profile emulator exec api python -m app.cli grant-admin LOCAL_UID
```

Emulator users persist in the `auth_data` volume on a graceful stop. Stop using
the same options (`docker compose --env-file .env.emulator --profile emulator down`).
Default real and emulator modes share local PostgreSQL unless you use different
Compose project names. Use `-p sports-fanatics-emulator` on every emulator command
and separate host ports if you want isolated databases or to run both at once.
