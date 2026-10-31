from pydantic import BaseModel, Field, model_validator
from app.models.base import RequestModel


class GridAnswer(RequestModel):
    player_id: int = Field(gt=0)
    team_ids: list[int] = Field(min_length=2, max_length=2)

    @model_validator(mode="after")
    def distinct_teams(self):
        if len(set(self.team_ids)) != 2 or any(team <= 0 for team in self.team_ids):
            raise ValueError("Choose two distinct positive team IDs")
        return self


class GuessAnswer(RequestModel):
    puzzle_id: str
    answer: str = Field(max_length=120)


class GamePlayer(BaseModel):
    id: int
    name: str


class DraftPlayer(GamePlayer):
    team: str
    position: str
    rank: int


class GameTeam(GamePlayer):
    abbreviation: str


class Puzzle(BaseModel):
    id: str
    clues: list[str]


class CatalogResponse(BaseModel):
    players: list[DraftPlayer]
    puzzles: list[Puzzle]
    unavailable: list[str]
    rankingLabel: str


class GridResponse(BaseModel):
    match: bool
    player: GamePlayer


class GuessResponse(BaseModel):
    match: bool
    name: str | None


class RevealResponse(BaseModel):
    name: str


class GridLayout(BaseModel):
    rows: list[GameTeam]
    columns: list[GameTeam]
