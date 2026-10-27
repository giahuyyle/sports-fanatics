from sqlalchemy.orm import Mapped, mapped_column, sessionmaker
from app.schema.base import Base

from sqlalchemy import (
    String,
    Boolean
)

class Player(Base):
    __tablename__ = "players"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    first_name: Mapped[str] = mapped_column(String(20))
    last_name: Mapped[str] = mapped_column(String(20))
    full_name: Mapped[str] = mapped_column(String(40))

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_injured: Mapped[bool] = mapped_column(Boolean, default=False)