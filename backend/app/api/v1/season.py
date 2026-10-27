from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.models.season import SeasonStatResponse
from app.schema.player import Player
from app.services.season import SeasonScope, get_player_seasons

router = APIRouter(prefix="/players", tags=["season stats"])
SessionDep = Annotated[Session, Depends(get_db)]


@router.get("/{player_id}/seasons", response_model=list[SeasonStatResponse])
def list_player_seasons(
    player_id: int, session: SessionDep, scope: SeasonScope = "overall"
):
    if session.get(Player, player_id) is None:
        raise HTTPException(status_code=404, detail="Player not found")
    return get_player_seasons(session, player_id, scope=scope)


@router.get("/{player_id}/seasons/{season_id}", response_model=list[SeasonStatResponse])
def get_player_season(
    player_id: int,
    season_id: Annotated[str, Path(pattern=r"^\d{4}-\d{2}$")],
    session: SessionDep,
    scope: SeasonScope = "overall",
):
    if session.get(Player, player_id) is None:
        raise HTTPException(status_code=404, detail="Player not found")
    return get_player_seasons(session, player_id, season_id, scope)
