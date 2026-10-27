from pydantic import Field, model_validator

from app.models.base import ORMResponseModel, RequestModel


class PlayerResponse(ORMResponseModel):
    id: int

    first_name: str
    last_name: str
    full_name: str

    is_active: bool
    is_injured: bool


class PlayerUpdate(RequestModel):
    is_active: bool | None = None
    is_injured: bool | None = None

    @model_validator(mode="after")
    def validate_status(self):
        if not self.model_fields_set:
            raise ValueError("Provide is_active or is_injured")
        for field in self.model_fields_set:
            if getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class PlayerCreate(RequestModel):
    id: int = Field(gt=0)
    first_name: str = Field(max_length=20)
    last_name: str = Field(max_length=20)
    full_name: str = Field(max_length=40)
    is_active: bool = True
    is_injured: bool = False
