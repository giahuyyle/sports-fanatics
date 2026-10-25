import unicodedata

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.auth import SessionDep, UserDep
from app.db.identity import FantasyTeam
from app.errors import DomainError

router = APIRouter(tags=["identity"])


class TeamInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=80)


def normalized_name(name: str) -> tuple[str, str]:
    display = " ".join(unicodedata.normalize("NFKC", name).split())
    if not display or any(unicodedata.category(c).startswith("C") for c in display):
        raise DomainError("invalid_team_name", "Enter a visible team name.", 422)
    key = display.casefold()
    if len(display) > 80 or len(key) > 240:
        raise DomainError(
            "invalid_team_name", "Team name is too long after normalization.", 422
        )
    return display, key


@router.get("/me")
def me(user: UserDep, session: SessionDep):
    team = session.scalar(select(FantasyTeam).where(FantasyTeam.user_id == user.id))
    return {"id": user.id, "is_admin": user.is_admin, "team": team}


def save_team(body: TeamInput, user, session, create: bool):
    team = session.scalar(select(FantasyTeam).where(FantasyTeam.user_id == user.id))
    if create and team:
        raise DomainError("team_exists", "You already own a team.")
    if not create and not team:
        raise DomainError("team_not_found", "Create your team first.", 404)
    name, key = normalized_name(body.name)
    if team is None:
        team = FantasyTeam(user_id=user.id, name=name, name_key=key)
        session.add(team)
    else:
        team.name, team.name_key = name, key
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise DomainError(
            "team_name_taken", "That team name is already claimed."
        ) from exc
    session.refresh(team)
    return team


@router.post("/me/team", status_code=201)
def create_team(body: TeamInput, user: UserDep, session: SessionDep):
    return save_team(body, user, session, True)


@router.patch("/me/team")
def rename_team(body: TeamInput, user: UserDep, session: SessionDep):
    return save_team(body, user, session, False)
