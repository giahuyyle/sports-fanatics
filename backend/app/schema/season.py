"""
represents a players' basic stats during that season
"""

from sqlalchemy.orm import Mapped, mapped_column, sessionmaker
from base import Base

from sqlalchemy import (
    String,
    Boolean,
    Float,
    ForeignKey
)

class Season(Base):
    __tablename__ = "seasons"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    player_id: Mapped[int] = mapped_column(
        ForeignKey("players.id", ondelete="CASCADE"), nullable=False
    )

    season_name: Mapped[str] = mapped_column(String(5))

    # games played
    games: Mapped[int] = mapped_column(default=0)
    # minutes played
    minutes: Mapped[int] = mapped_column(default=0)

    # per game avg
    ppg: Mapped[float] = mapped_column(Float)
    rpg: Mapped[float] = mapped_column(Float)
    apg: Mapped[float] = mapped_column(Float)