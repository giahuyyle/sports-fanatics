from collections.abc import Generator

from fastapi import Request
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.config import Settings


def make_engine(settings: Settings):
    return create_engine(settings.database_url, pool_pre_ping=True)


def get_session(request: Request) -> Generator[Session]:
    with Session(request.app.state.engine) as session:
        yield session
