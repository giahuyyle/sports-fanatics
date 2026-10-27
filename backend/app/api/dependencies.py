from collections.abc import Generator

from sqlalchemy.orm import Session

from app.schema.base import SessionLocal


def get_db() -> Generator[Session, None, None]:
    with SessionLocal() as session:
        yield session
