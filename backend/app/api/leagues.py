import secrets
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Request
from pydantic import Field
from sqlalchemy import delete, select

from app.api.catalog import Input, get_or_404
from app.auth import SessionDep, UserDep
from app.db.catalog import PlayerPool, PoolPlayer
from app.db.draft import Draft, League, LeagueEntry, Pick, QueueItem, RosterSlot
from app.db.identity import FantasyTeam
from app.domain.drafts import (
    candidates,
    lock_league,
    manual_pick,
    membership,
    selections,
    start_draft,
    team_for,
    turn,
)
from app.domain.roster import validate_lineup
from app.errors import DomainError

router = APIRouter(tags=["leagues and drafts"])


class LeagueInput(Input):
    name: str = Field(min_length=1, max_length=120)
    pool_id: UUID
    capacity: Literal[2, 4, 6] = 4
    timer: Literal[30, 45, 60, 90] = 60


class JoinInput(Input):
    invite_code: str = Field(min_length=1, max_length=32)


class PickInput(Input):
    pool_player_id: UUID
    expected_revision: int = Field(ge=1)
    idempotency_key: str = Field(min_length=8, max_length=128)


class QueueInput(Input):
    pool_player_ids: list[UUID] = Field(max_length=1000)


class SlotInput(Input):
    role: Literal["starter", "bench"]
    position: Literal["PG", "SG", "SF", "PF", "C"]
    pool_player_id: UUID


class LineupInput(Input):
    slots: list[SlotInput] = Field(min_length=10, max_length=10)


def snapshot(session, league_id):
    league = lock_league(session, league_id)
    entries = session.execute(
        select(LeagueEntry, FantasyTeam)
        .join(FantasyTeam, LeagueEntry.team_id == FantasyTeam.id)
        .where(LeagueEntry.league_id == league_id)
        .order_by(LeagueEntry.id)
    ).all()
    draft = session.get(Draft, league_id)
    picks = session.scalars(
        select(Pick).where(Pick.draft_id == league_id).order_by(Pick.number)
    ).all()
    return {
        "id": league.id,
        "name": league.name,
        "owner_id": league.owner_id,
        "invite_code": league.invite_code,
        "capacity": league.capacity,
        "timer": league.timer,
        "roster_size": 10,
        "status": league.status,
        "pool_id": league.pool_id,
        "entries": [{"id": e.id, "team_id": t.id, "name": t.name} for e, t in entries],
        "draft": {
            "revision": draft.revision,
            "order": draft.manager_order,
            "deadline": draft.deadline,
            "pause_reason": draft.pause_reason,
            "current_entry_id": turn(draft.manager_order, len(picks))
            if league.status == "live"
            else None,
        }
        if draft
        else None,
        "picks": picks,
        "lineups": session.scalars(
            select(RosterSlot)
            .join(LeagueEntry, RosterSlot.entry_id == LeagueEntry.id)
            .where(LeagueEntry.league_id == league_id)
        ).all(),
    }


@router.post("/leagues", status_code=201)
def create_league(body: LeagueInput, user: UserDep, session: SessionDep):
    team = team_for(session, user)
    pool = get_or_404(session, PlayerPool, body.pool_id)
    if pool.status != "published":
        raise DomainError("pool_unpublished", "Choose a published player pool.", 422)
    league = League(
        **body.model_dump(), owner_id=user.id, invite_code=secrets.token_urlsafe(12)
    )
    session.add(league)
    session.flush()
    session.add(LeagueEntry(league_id=league.id, team_id=team.id))
    session.commit()
    return snapshot(session, league.id)


@router.get("/leagues")
def leagues(user: UserDep, session: SessionDep):
    team = team_for(session, user)
    rows = session.scalars(
        select(League).join(LeagueEntry).where(LeagueEntry.team_id == team.id)
    ).all()
    return [
        {
            "id": league.id,
            "name": league.name,
            "status": league.status,
            "capacity": league.capacity,
        }
        for league in rows
    ]


@router.post("/leagues/join")
def join_league(body: JoinInput, user: UserDep, session: SessionDep):
    team = team_for(session, user)
    league = session.scalar(
        select(League).where(League.invite_code == body.invite_code).with_for_update()
    )
    if not league:
        raise DomainError("invite_not_found", "That invite code is not valid.", 404)
    entries = session.scalars(
        select(LeagueEntry).where(LeagueEntry.league_id == league.id)
    ).all()
    if any(e.team_id == team.id for e in entries):
        return snapshot(session, league.id)
    if league.status != "lobby":
        raise DomainError("draft_started", "This draft has already started.")
    if len(entries) >= league.capacity:
        raise DomainError("league_full", "This league is full.")
    session.add(LeagueEntry(league_id=league.id, team_id=team.id))
    session.commit()
    return snapshot(session, league.id)


@router.get("/leagues/{league_id}")
def league_snapshot(league_id: UUID, user: UserDep, session: SessionDep):
    membership(session, league_id, user)
    # Serialize snapshot reads with mutations so revisions and picks cannot disagree.
    lock_league(session, league_id)
    return snapshot(session, league_id)


@router.post("/leagues/{league_id}/start")
def start(league_id: UUID, request: Request, user: UserDep, session: SessionDep):
    league = lock_league(session, league_id)
    if league.owner_id != user.id:
        raise DomainError(
            "owner_required", "Only the league owner can start the draft.", 403
        )
    start_draft(session, league, request.app.state.settings.solver_timeout_seconds)
    session.commit()
    return snapshot(session, league_id)


@router.post("/leagues/{league_id}/picks")
def pick(
    league_id: UUID,
    body: PickInput,
    request: Request,
    user: UserDep,
    session: SessionDep,
):
    league = lock_league(session, league_id)
    entry = membership(session, league_id, user)
    result = manual_pick(
        session, league, entry, body, request.app.state.settings.solver_timeout_seconds
    )
    session.commit()
    session.refresh(result)
    return result


@router.get("/leagues/{league_id}/queue")
def queue(league_id: UUID, user: UserDep, session: SessionDep):
    entry = membership(session, league_id, user)
    return session.scalars(
        select(QueueItem)
        .where(QueueItem.entry_id == entry.id)
        .order_by(QueueItem.priority)
    ).all()


@router.put("/leagues/{league_id}/queue")
def replace_queue(
    league_id: UUID, body: QueueInput, user: UserDep, session: SessionDep
):
    league = lock_league(session, league_id)
    entry = membership(session, league_id, user)
    ids = body.pool_player_ids
    if len(set(ids)) != len(ids):
        raise DomainError("invalid_queue", "Do not repeat players in a queue.", 422)
    pool_ids = set(
        session.scalars(
            select(PoolPlayer.id).where(PoolPlayer.pool_id == league.pool_id)
        )
    )
    taken = {UUID(p) for p in selections(session, league_id)}
    if not set(ids).issubset(pool_ids - taken):
        raise DomainError(
            "invalid_queue",
            "Queue only available players from this league's pool.",
            422,
        )
    session.execute(delete(QueueItem).where(QueueItem.entry_id == entry.id))
    session.add_all(
        [
            QueueItem(entry_id=entry.id, pool_player_id=p, priority=i)
            for i, p in enumerate(ids)
        ]
    )
    session.commit()
    return {"pool_player_ids": ids}


@router.put("/leagues/{league_id}/lineup")
def replace_lineup(
    league_id: UUID, body: LineupInput, user: UserDep, session: SessionDep
):
    league = lock_league(session, league_id)
    entry = membership(session, league_id, user)
    if league.status != "complete":
        raise DomainError(
            "draft_incomplete", "Finish drafting before editing the lineup."
        )
    picks = session.scalars(select(Pick).where(Pick.entry_id == entry.id)).all()
    owned = {str(p.pool_player_id): p for p in picks}
    slots = [
        {"role": s.role, "position": s.position, "player_id": str(s.pool_player_id)}
        for s in body.slots
    ]
    validate_lineup(candidates(session, league.pool_id), owned, slots)
    session.execute(delete(RosterSlot).where(RosterSlot.entry_id == entry.id))
    session.add_all(
        [
            RosterSlot(
                entry_id=entry.id,
                pick_id=owned[s["player_id"]].id,
                role=s["role"],
                position=s["position"],
            )
            for s in slots
        ]
    )
    session.commit()
    return {"slots": body.slots}
