import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import Settings
from app.db.identity import User
from app.main import create_app


@pytest.fixture
def db_app(monkeypatch):
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("Set TEST_DATABASE_URL to a dedicated migrated PostgreSQL database")
    if not url.split("?")[0].endswith("_test"):
        pytest.fail("Refusing to reset a database whose name does not end in _test")
    app = create_app(Settings(database_url=url))
    with app.state.engine.begin() as connection:
        tables = connection.scalars(
            text(
                "SELECT tablename FROM pg_tables WHERE schemaname='public' "
                "AND tablename <> 'alembic_version'"
            )
        ).all()
        if tables:
            connection.execute(
                text(
                    "TRUNCATE " + ", ".join('"' + t + '"' for t in tables) + " CASCADE"
                )
            )

    def verified(token, project):
        if token == "invalid":
            from app.errors import DomainError

            raise DomainError("invalid_token", "Invalid test token.", 401)
        return {"uid": token}

    monkeypatch.setattr("app.auth.verify_token", verified)
    with TestClient(app) as client:
        client.get("/api/v1/me", headers={"Authorization": "Bearer admin"})
        with Session(app.state.engine) as session:
            session.query(User).filter_by(firebase_uid="admin").one().is_admin = True
            session.commit()
        yield app, client


def headers(uid="admin"):
    return {"Authorization": f"Bearer {uid}"}
