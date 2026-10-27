from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.api.dependencies import get_db
from app.models.team import TeamResponse, TeamUpdate
from app.schema.team import Team

router = APIRouter(prefix="/teams", tags=["teams"])
SessionDep = Annotated[Session, Depends(get_db)]


@router.get("", response_model=list[TeamResponse])
def get_teams(session: SessionDep):
    return session.scalars(select(Team).order_by(Team.id)).all()


@router.get("/{team_id}", response_model=TeamResponse)
def get_team(team_id: int, session: SessionDep):
    team = session.get(Team, team_id)
    if team is None:
        raise HTTPException(status_code=404, detail="Team not found")
    return team


@router.put("/{team_id}", response_model=TeamResponse)
def update_team(team_id: int, payload: TeamUpdate, session: SessionDep):
    team = session.get(Team, team_id)
    if team is None:
        raise HTTPException(status_code=404, detail="Team not found")

    for field, value in payload.model_dump().items():
        setattr(team, field, value)

    session.commit()
    session.refresh(team)
    return team
