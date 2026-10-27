from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.dependencies import get_db
from app.models.player import PlayerCreate, PlayerResponse, PlayerUpdate
from app.schema.player import Player

router = APIRouter(prefix="/players", tags=["players"])
SessionDep = Annotated[Session, Depends(get_db)]

@router.get("", response_model=list[PlayerResponse])
def get_players(session: SessionDep):
    return session.scalars(select(Player).order_by(Player.id)).all()


@router.get("/{player_id}", response_model=PlayerResponse)
def get_player(player_id: int, session: SessionDep):
    player = session.get(Player, player_id)
    if player is None:
        raise HTTPException(status_code=404, detail="Player not found")
    return player


@router.put("/{player_id}", response_model=PlayerResponse)
def update_player(player_id: int, payload: PlayerUpdate, session: SessionDep):
    player = session.get(Player, player_id)
    if player is None:
        raise HTTPException(status_code=404, detail="Player not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(player, field, value)

    session.commit()
    session.refresh(player)
    return player


@router.post("", response_model=PlayerResponse, status_code=201)
def create_player(payload: PlayerCreate, session: SessionDep):
    if session.get(Player, payload.id) is not None:
        raise HTTPException(status_code=409, detail="Player ID already exists")

    player = Player(**payload.model_dump())
    session.add(player)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=409, detail="Player conflicts with an existing record")
    session.refresh(player)
    return player
