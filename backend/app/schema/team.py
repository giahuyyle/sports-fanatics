from sqlalchemy.orm import Mapped, mapped_column, sessionmaker
from base import Base

from sqlalchemy import (
    String
)

class Team(Base):
    __tablename__ = "teams"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    short_name: Mapped[str] = mapped_column(String(3))
    full_name: Mapped[str] = mapped_column(String(35))