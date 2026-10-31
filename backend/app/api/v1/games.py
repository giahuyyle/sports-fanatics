"""Read-only game catalog and stateless answer validation."""
from fastapi import APIRouter, HTTPException, Query

from app.api.v1.player import SessionDep
from app.models.game import (
    CatalogResponse, GridAnswer, GridResponse, GuessAnswer, GuessResponse,
    RevealResponse, GridLayout,
)
from app.schema.player import Player
from app.schema.team import Team
from app.services.games import DATA, catalog, matches_teams, normalize, player_map, random_grid

router = APIRouter(prefix="/games", tags=["games"])


@router.get("/catalog", response_model=CatalogResponse)
def get_catalog(session: SessionDep):
    return catalog(session)


@router.get("/grid", response_model=GridLayout)
def get_grid(session: SessionDep, previous: str = Query(default="", max_length=200)):
    layout = random_grid(session, previous)
    if layout is None:
        raise HTTPException(503, "Not enough imported histories for a playable grid")
    return layout


@router.post("/grid/validate", response_model=GridResponse)
def validate_grid(payload: GridAnswer, session: SessionDep):
    player = session.get(Player, payload.player_id)
    if player is None:
        raise HTTPException(404, "Player not found")
    if any(session.get(Team, team_id) is None for team_id in payload.team_ids):
        raise HTTPException(404, "Team not found")
    return {"match": matches_teams(session, player.id, payload.team_ids),
            "player": {"id": player.id, "name": player.full_name}}


def mystery_for(puzzle_id, session):
    if puzzle_id not in [str(i) for i in range(len(DATA["mysteries"]))]:
        raise HTTPException(404, "Puzzle not found")
    mystery = DATA["mysteries"][int(puzzle_id)]
    player = player_map(session).get(normalize(mystery["name"]))
    if player is None:
        raise HTTPException(404, "Puzzle player unavailable")
    return mystery, player


@router.post("/guess/validate", response_model=GuessResponse)
def validate_guess(payload: GuessAnswer, session: SessionDep):
    mystery, player = mystery_for(payload.puzzle_id, session)
    match = normalize(payload.answer) == normalize(mystery["name"])
    return {"match": match, "name": player.full_name if match else None}


@router.post("/guess/{puzzle_id}/reveal", response_model=RevealResponse)
def reveal_guess(puzzle_id: str, session: SessionDep):
    _, player = mystery_for(puzzle_id, session)
    return {"name": player.full_name}
