from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class DraftEvent(Base):
    __tablename__ = "draft_events"
    __table_args__ = (UniqueConstraint("draft_id", "revision"),)
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    draft_id: Mapped[UUID] = mapped_column(ForeignKey("drafts.id"))
    revision: Mapped[int] = mapped_column(Integer)
    kind: Mapped[str] = mapped_column(String(40))
    payload: Mapped[dict] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
