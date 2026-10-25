from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Totals(Input):
    games: int = Field(ge=0)
    starts: int = Field(ge=0)
    minutes: float = Field(ge=0, allow_inf_nan=False)
    points: int = Field(ge=0)
    rebounds: int = Field(ge=0)
    assists: int = Field(ge=0)
    steals: int = Field(ge=0)
    blocks: int = Field(ge=0)
    turnovers: int = Field(ge=0)
    fouls: int = Field(ge=0)
    fg_made: int = Field(ge=0)
    fg_attempted: int = Field(ge=0)
    three_made: int = Field(ge=0)
    three_attempted: int = Field(ge=0)
    ft_made: int = Field(ge=0)
    ft_attempted: int = Field(ge=0)

    @model_validator(mode="after")
    def valid(self):
        if self.starts > self.games:
            raise ValueError("Starts exceed games")
        for prefix in ("fg", "three", "ft"):
            if getattr(self, prefix + "_made") > getattr(self, prefix + "_attempted"):
                raise ValueError("Made shots exceed attempted shots")
        if self.three_made > self.fg_made or self.three_attempted > self.fg_attempted:
            raise ValueError("Three pointers exceed field goals")
        if self.games == 0 and any(self.model_dump().values()):
            raise ValueError("No-appearance rows must have zero totals")
        return self


class StatRow(Input):
    player_id: UUID
    season: int = Field(ge=1946, le=2100)
    phase: Literal["regular", "playoffs"]
    scope: str = Field(min_length=1, max_length=12)
    totals: Totals
