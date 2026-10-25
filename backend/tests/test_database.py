import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.config import Settings
from app.main import create_app


@pytest.mark.skipif(
    not os.environ.get("TEST_DATABASE_URL"), reason="PostgreSQL required"
)
def test_database_ready_and_revision():
    app = create_app(Settings(database_url=os.environ["TEST_DATABASE_URL"]))
    with TestClient(app) as client:
        assert client.get("/api/ready").json() == {"status": "ok"}
        with app.state.engine.connect() as connection:
            assert connection.scalar(text("SELECT version_num FROM alembic_version"))
