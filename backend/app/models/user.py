from datetime import datetime, timezone
from pydantic import field_serializer
from app.models.base import ORMResponseModel


class UserResponse(ORMResponseModel):
    id: int
    email: str | None
    display_name: str | None
    photo_url: str | None
    email_verified: bool
    created_at: datetime
    updated_at: datetime

    @field_serializer("created_at", "updated_at")
    def serialize_timestamp(self, value: datetime):
        return value.replace(tzinfo=timezone.utc).isoformat() if value.tzinfo is None else value.isoformat()
