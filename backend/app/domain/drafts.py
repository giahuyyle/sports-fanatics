import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import delete, func, select

from app.db.catalog import PoolPlayer
from app.db.draft import Draft, League, LeagueEntry, Pick, QueueItem, RosterSlot
from app.db.identity import FantasyTeam
from app.domain.catalog import POSITIONS
from app.domain.roster import Candidate, solve_completion, validate_completion
from app.errors import DomainError


def team_for(session, user):
    team = session.scalar(select(FantasyTeam).where(FantasyTeam.user_id == user.id))
    if not team:
        raise DomainError("team_required", "Create your fantasy team first.", 422)
    return team


def membership(session, league_id, user):
    team = session.scalar(select(FantasyTeam).where(FantasyTeam.user_id == user.id))
    if not team:
        raise DomainError(
            "league_access_denied", "You are not a member of this league.", 403
        )
    entry = session.scalar(
        select(LeagueEntry).where(
            LeagueEntry.league_id == league_id, LeagueEntry.team_id == team.id
        )
    )
    if not entry:
        raise DomainError(
            "league_access_denied", "You are not a member of this league.", 403
        )
    return entry


def lock_league(session, league_id):
    league = session.scalar(
        select(League).where(League.id == league_id).with_for_update()
    )
    if not league:
        raise DomainError("league_not_found", "League was not found.", 404)
    return league


def candidates(session, pool_id):
    rows = session.scalars(
        select(PoolPlayer)
        .where(PoolPlayer.pool_id == pool_id)
        .order_by(PoolPlayer.priority, PoolPlayer.id)
    ).all()
    return [Candidate(str(p.id), p.tier, tuple(p.positions), p.priority) for p in rows]


def selections(session, draft_id):
    return {
        str(p.pool_player_id): str(p.entry_id)
        for p in session.scalars(select(Pick).where(Pick.draft_id == draft_id))
    }


def turn(order, pick_count):
    n = len(order)
    index = pick_count % n
    return order[index if (pick_count // n) % 2 == 0 else n - 1 - index]


def start_draft(session, league, timeout):
    if league.status != "lobby":
        raise DomainError("draft_started", "This league has already started.")
    entries = session.scalars(
        select(LeagueEntry).where(LeagueEntry.league_id == league.id)
    ).all()
    if len(entries) != league.capacity:
        raise DomainError("league_not_full", "Fill all manager places before starting.")
    order = [str(e.id) for e in entries]
    secrets.SystemRandom().shuffle(order)
    completion = solve_completion(
        candidates(session, league.pool_id), order, {}, timeout
    )
    draft = Draft(
        id=league.id,
        pool_id=league.pool_id,
        manager_order=order,
        completion=completion,
        revision=1,
        deadline=datetime.now(UTC) + timedelta(seconds=league.timer),
    )
    session.add(draft)
    league.status = "live"
    session.flush()
    return draft


def commit_selection(
    session, league, draft, player_id, manager, completion, automatic=False, key=None
):
    count = session.scalar(
        select(func.count()).select_from(Pick).where(Pick.draft_id == draft.id)
    )
    pick = Pick(
        draft_id=draft.id,
        number=count,
        entry_id=UUID(manager),
        pool_player_id=UUID(player_id),
        automatic=automatic,
        idempotency_key=key,
    )
    session.add(pick)
    session.flush()
    draft.completion = completion
    draft.revision += 1
    # Remove a drafted player from every manager's queue in this league.
    entry_ids = select(LeagueEntry.id).where(LeagueEntry.league_id == league.id)
    session.execute(
        delete(QueueItem).where(
            QueueItem.entry_id.in_(entry_ids),
            QueueItem.pool_player_id == UUID(player_id),
        )
    )
    if count + 1 == league.capacity * 10:
        league.status = "complete"
        draft.deadline = None
        picks = session.scalars(select(Pick).where(Pick.draft_id == draft.id)).all()
        pick_map = {(str(p.entry_id), str(p.pool_player_id)): p for p in picks}
        for entry_id, assignments in completion.items():
            for position in POSITIONS:
                ids = sorted(p for p, pos in assignments.items() if pos == position)
                for role, candidate_id in zip(("starter", "bench"), ids, strict=True):
                    session.add(
                        RosterSlot(
                            entry_id=UUID(entry_id),
                            role=role,
                            position=position,
                            pick_id=pick_map[entry_id, candidate_id].id,
                        )
                    )
    else:
        draft.deadline = datetime.now(UTC) + timedelta(seconds=league.timer)
    session.flush()
    return pick


def manual_pick(session, league, entry, body, timeout):
    draft = session.get(Draft, league.id)
    existing = session.scalar(
        select(Pick).where(
            Pick.draft_id == league.id, Pick.idempotency_key == body.idempotency_key
        )
    )
    if existing:
        if (
            existing.entry_id != entry.id
            or existing.pool_player_id != body.pool_player_id
        ):
            raise DomainError(
                "idempotency_conflict",
                "That request key was used for another selection.",
            )
        return existing
    if not draft or league.status != "live":
        raise DomainError("draft_not_live", "Draft is not accepting selections.")
    if draft.revision != body.expected_revision:
        raise DomainError("stale_revision", "Refresh the draft before selecting.")
    selected = selections(session, league.id)
    if turn(draft.manager_order, len(selected)) != str(entry.id):
        raise DomainError("not_your_turn", "Wait for your turn.", 403)
    if draft.deadline <= datetime.now(UTC):
        raise DomainError(
            "turn_expired", "The turn expired; wait for the automatic selection."
        )
    player_id = str(body.pool_player_id)
    pool = candidates(session, draft.pool_id)
    if player_id in selected:
        raise DomainError("player_taken", "That player has already been drafted.")
    if player_id not in {p.id for p in pool}:
        raise DomainError(
            "player_not_in_pool", "Select a player from this draft's pool.", 422
        )
    completion = solve_completion(
        pool, draft.manager_order, {**selected, player_id: str(entry.id)}, timeout
    )
    return commit_selection(
        session,
        league,
        draft,
        player_id,
        str(entry.id),
        completion,
        key=body.idempotency_key,
    )


def automatic_pick(session, league, draft, timeout):
    selected = selections(session, draft.id)
    pool = candidates(session, draft.pool_id)
    manager = turn(draft.manager_order, len(selected))
    queued = session.scalars(
        select(QueueItem.pool_player_id)
        .where(QueueItem.entry_id == UUID(manager))
        .order_by(QueueItem.priority)
    ).all()
    ordered = list(dict.fromkeys([str(p) for p in queued] + [p.id for p in pool]))
    # Bound the total automatic-pick search time.
    import time

    deadline = time.monotonic() + timeout
    for player_id in ordered:
        if player_id in selected:
            continue
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            break
        try:
            completion = solve_completion(
                pool, draft.manager_order, {**selected, player_id: manager}, remaining
            )
            return commit_selection(
                session, league, draft, player_id, manager, completion, True
            )
        except DomainError as error:
            if error.code == "validation_unavailable":
                break
            if error.code not in ("tier_quota", "roster_infeasible"):
                raise
    if validate_completion(pool, draft.manager_order, selected, draft.completion):
        fallback = next(
            (
                p.id
                for p in pool
                if p.id in draft.completion[manager] and p.id not in selected
            ),
            None,
        )
        if fallback:
            return commit_selection(
                session, league, draft, fallback, manager, draft.completion, True
            )
    league.status = "paused"
    draft.pause_reason = (
        "No verified completion is available. Administrator attention required."
    )
    draft.deadline = None
    draft.revision += 1
    return None
