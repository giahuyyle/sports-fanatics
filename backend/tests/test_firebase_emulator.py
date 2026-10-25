"""Optional real SDK/emulator checks, without the mock verifier fixture."""

import os
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


@pytest.mark.skipif(
    not os.environ.get("FIREBASE_AUTH_EMULATOR_HOST")
    or not os.environ.get("TEST_DATABASE_URL"),
    reason="Requires Firebase Auth emulator and PostgreSQL",
)
def test_real_firebase_tokens_and_disabled_accounts():
    host = os.environ["FIREBASE_AUTH_EMULATOR_HOST"]
    assert host.startswith(("localhost:", "127.0.0.1:")), "Local emulator only"
    email = f"sdk-{uuid4()}@example.test"
    response = httpx.post(
        f"http://{host}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key",
        json={
            "email": email,
            "password": "local-password-only",
            "returnSecureToken": True,
        },
    )
    assert response.status_code == 200, response.text
    token, uid = response.json()["idToken"], response.json()["localId"]
    import jwt

    payload = jwt.decode(token, options={"verify_signature": False})
    payload["exp"] = 1
    expired = jwt.encode(payload, key="", algorithm="none")
    app = create_app(Settings(database_url=os.environ["TEST_DATABASE_URL"]))
    with TestClient(app) as client:
        assert (
            client.get(
                "/api/v1/me", headers={"Authorization": f"Bearer {token}"}
            ).status_code
            == 200
        )
        assert (
            client.get(
                "/api/v1/me", headers={"Authorization": "Bearer malformed"}
            ).status_code
            == 401
        )
        assert (
            client.get(
                "/api/v1/me", headers={"Authorization": f"Bearer {expired}"}
            ).status_code
            == 401
        )
        import firebase_admin
        from firebase_admin import auth

        firebase_app = firebase_admin.get_app(app.state.settings.firebase_project_id)
        auth.update_user(uid, disabled=True, app=firebase_app)
        assert (
            client.get(
                "/api/v1/me", headers={"Authorization": f"Bearer {token}"}
            ).status_code
            == 401
        )
