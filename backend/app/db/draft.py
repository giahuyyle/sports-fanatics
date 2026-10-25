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
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class League(Base):
    __tablename__ = "leagues"
    __table_args__ = (
        CheckConstraint("capacity IN (2,4,6)", name="capacity"),
        CheckConstraint("timer IN (30,45,60,90)", name="timer"),
        CheckConstraint(
            "status IN ('lobby','live','paused','complete')", name="status"
        ),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(120))
    invite_code: Mapped[str] = mapped_column(String(32), unique=True)
    owner_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    pool_id: Mapped[UUID] = mapped_column(ForeignKey("player_pools.id"))
    capacity: Mapped[int] = mapped_column(Integer, default=4)
    timer: Mapped[int] = mapped_column(Integer, default=60)
    status: Mapped[str] = mapped_column(String(12), default="lobby")


class LeagueEntry(Base):
    __tablename__ = "league_entries"
    __table_args__ = (UniqueConstraint("league_id", "team_id"),)
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    league_id: Mapped[UUID] = mapped_column(ForeignKey("leagues.id"))
    team_id: Mapped[UUID] = mapped_column(ForeignKey("fantasy_teams.id"))


class Draft(Base):
    __tablename__ = "drafts"
    id: Mapped[UUID] = mapped_column(ForeignKey("leagues.id"), primary_key=True)
    pool_id: Mapped[UUID] = mapped_column(ForeignKey("player_pools.id"))
    revision: Mapped[int] = mapped_column(Integer, default=1)
    manager_order: Mapped[list] = mapped_column(JSONB)
    completion: Mapped[dict] = mapped_column(JSONB)
    deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    pause_reason: Mapped[str | None] = mapped_column(String(200))


class Pick(Base):
    __tablename__ = "picks"
    __table_args__ = (
        UniqueConstraint("draft_id", "number", name="uq_pick_number"),
        UniqueConstraint("draft_id", "pool_player_id", name="uq_pick_player"),
        UniqueConstraint("draft_id", "idempotency_key", name="uq_pick_request"),
        CheckConstraint("number >= 0", name="number"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    draft_id: Mapped[UUID] = mapped_column(ForeignKey("drafts.id"))
    number: Mapped[int] = mapped_column(Integer)
    entry_id: Mapped[UUID] = mapped_column(ForeignKey("league_entries.id"))
    pool_player_id: Mapped[UUID] = mapped_column(ForeignKey("pool_players.id"))
    automatic: Mapped[bool] = mapped_column(Boolean, default=False)
    idempotency_key: Mapped[str | None] = mapped_column(String(128))


class RosterSlot(Base):
    __tablename__ = "roster_slots"
    __table_args__ = (
        UniqueConstraint("entry_id", "role", "position"),
        CheckConstraint("role IN ('starter','bench')", name="role"),
        CheckConstraint("position IN ('PG','SG','SF','PF','C')", name="position"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    entry_id: Mapped[UUID] = mapped_column(ForeignKey("league_entries.id"))
    pick_id: Mapped[UUID] = mapped_column(ForeignKey("picks.id"), unique=True)
    role: Mapped[str] = mapped_column(String(10))
    position: Mapped[str] = mapped_column(String(2))


class QueueItem(Base):
    __tablename__ = "queue_items"
    __table_args__ = (UniqueConstraint("entry_id", "priority"),)
    entry_id: Mapped[UUID] = mapped_column(
        ForeignKey("league_entries.id"), primary_key=True
    )
    pool_player_id: Mapped[UUID] = mapped_column(
        ForeignKey("pool_players.id"), primary_key=True
    )
    priority: Mapped[int] = mapped_column(Integer)
