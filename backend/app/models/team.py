from pydantic import Field

from app.models.base import ORMResponseModel, RequestModel


class TeamResponse(ORMResponseModel):
    id: int

    abbreviation: str
    nick_name: str
    full_name: str

    city: str
    state: str

    year_founded: int

class TeamUpdate(RequestModel):
    abbreviation: str = Field(max_length=3)
    nick_name: str = Field(max_length=15)
    full_name: str = Field(max_length=35)
    city: str = Field(max_length=15)
    state: str = Field(max_length=15)
    year_founded: int
