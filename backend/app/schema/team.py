from sqlalchemy.orm import Mapped, mapped_column, sessionmaker
from app.schema.base import Base

from sqlalchemy import (
    String
)

class Team(Base):
    __tablename__ = "teams"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    abbreviation: Mapped[str] = mapped_column(String(3))
    nick_name: Mapped[str] = mapped_column(String(15))
    full_name: Mapped[str] = mapped_column(String(35))

    city: Mapped[str] = mapped_column(String(15))
    state: Mapped[str] = mapped_column(String(15))

    year_founded: Mapped[int] = mapped_column(nullable=False)