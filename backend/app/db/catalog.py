from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Player(Base):
    __tablename__ = "players"
    __table_args__ = (CheckConstraint("tier BETWEEN 1 AND 5", name="tier_range"),)
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(120), index=True)
    rookie_season: Mapped[int] = mapped_column(Integer)
    no_appearances: Mapped[bool] = mapped_column(Boolean, default=False)
    archived: Mapped[bool] = mapped_column(Boolean, default=False)
    tier: Mapped[int] = mapped_column(Integer)
    priority: Mapped[int] = mapped_column(Integer, default=0)
    nba_team_id: Mapped[UUID | None] = mapped_column(ForeignKey("nba_teams.id"))


class NBATeam(Base):
    __tablename__ = "nba_teams"
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    code: Mapped[str] = mapped_column(String(12), unique=True)
    name: Mapped[str] = mapped_column(String(120))


class ExternalPlayerID(Base):
    __tablename__ = "external_player_ids"
    __table_args__ = (UniqueConstraint("provider", "external_id"),)
    player_id: Mapped[UUID] = mapped_column(ForeignKey("players.id"), primary_key=True)
    provider: Mapped[str] = mapped_column(String(60), primary_key=True)
    external_id: Mapped[str] = mapped_column(String(120))


class PlayerPosition(Base):
    __tablename__ = "player_positions"
    __table_args__ = (
        CheckConstraint("position IN ('PG','SG','SF','PF','C')", name="position"),
    )
    player_id: Mapped[UUID] = mapped_column(ForeignKey("players.id"), primary_key=True)
    position: Mapped[str] = mapped_column(String(2), primary_key=True)


class ImportRun(Base):
    __tablename__ = "import_runs"
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    actor_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    source: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(20))
    errors: Mapped[list] = mapped_column(JSONB, default=list)
    row_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class SeasonStats(Base):
    __tablename__ = "player_season_stats"
    __table_args__ = (
        UniqueConstraint("player_id", "season", "phase", "scope"),
        CheckConstraint("phase IN ('regular','playoffs')", name="phase"),
        CheckConstraint(
            "(scope = 'TOTAL' AND nba_team_id IS NULL) OR "
            "(scope <> 'TOTAL' AND nba_team_id IS NOT NULL)",
            name="scope",
        ),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    player_id: Mapped[UUID] = mapped_column(ForeignKey("players.id"))
    season: Mapped[int] = mapped_column(Integer)
    phase: Mapped[str] = mapped_column(String(10))
    scope: Mapped[str] = mapped_column(String(12))
    nba_team_id: Mapped[UUID | None] = mapped_column(ForeignKey("nba_teams.id"))
    totals: Mapped[dict] = mapped_column(JSONB)
    import_run_id: Mapped[UUID] = mapped_column(ForeignKey("import_runs.id"))


class PlayerPool(Base):
    __tablename__ = "player_pools"
    __table_args__ = (
        CheckConstraint("status IN ('draft','published')", name="status"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(12), default="draft")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class PoolPlayer(Base):
    __tablename__ = "pool_players"
    __table_args__ = (
        UniqueConstraint("pool_id", "player_id"),
        CheckConstraint("tier BETWEEN 1 AND 5", name="tier_range"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    pool_id: Mapped[UUID] = mapped_column(ForeignKey("player_pools.id"))
    player_id: Mapped[UUID] = mapped_column(ForeignKey("players.id"))
    tier: Mapped[int] = mapped_column(Integer)
    positions: Mapped[list] = mapped_column(JSONB)
    priority: Mapped[int] = mapped_column(Integer)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    actor_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(80))
    target: Mapped[str] = mapped_column(String(120))
    details: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
