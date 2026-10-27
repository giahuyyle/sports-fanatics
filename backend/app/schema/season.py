from sqlalchemy import Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.schema.base import Base


class Season(Base):
    __tablename__ = "seasons_stats"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    player_id: Mapped[int] = mapped_column(
        ForeignKey("players.id", ondelete="CASCADE"), nullable=False
    )
    season_id: Mapped[str] = mapped_column(String(7))
    league_id: Mapped[str] = mapped_column(String(2))

    # aggregate rows can use team_id=0, so this is not a teams foreign key
    team_id: Mapped[int] = mapped_column()
    team_abbreviation: Mapped[str] = mapped_column(String(3))
    player_age: Mapped[float] = mapped_column(Float)

    gp: Mapped[int] = mapped_column()
    gs: Mapped[int] = mapped_column()
    min: Mapped[float] = mapped_column(Float)

    fgm: Mapped[int] = mapped_column()
    fga: Mapped[int] = mapped_column()
    fg_pct: Mapped[float] = mapped_column(Float)
    fg3m: Mapped[int] = mapped_column()
    fg3a: Mapped[int] = mapped_column()
    fg3_pct: Mapped[float] = mapped_column(Float)
    ftm: Mapped[int] = mapped_column()
    fta: Mapped[int] = mapped_column()
    ft_pct: Mapped[float] = mapped_column(Float)

    oreb: Mapped[int] = mapped_column()
    dreb: Mapped[int] = mapped_column()
    reb: Mapped[int] = mapped_column()
    ast: Mapped[int] = mapped_column()
    stl: Mapped[int] = mapped_column()
    blk: Mapped[int] = mapped_column()
    tov: Mapped[int] = mapped_column()
    pf: Mapped[int] = mapped_column()
    pts: Mapped[int] = mapped_column()

    # per-game averages
    ppg: Mapped[float] = mapped_column(Float)
    apg: Mapped[float] = mapped_column(Float)
    rpg: Mapped[float] = mapped_column(Float)
    orpg: Mapped[float] = mapped_column(Float)
    drpg: Mapped[float] = mapped_column(Float)
