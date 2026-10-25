"""Operator-triggered nba_api synchronization with per-player transactions."""

from sqlalchemy import func, select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.db.catalog import ExternalPlayerID, ImportRun, NBATeam, Player
from app.db.identity import User
from app.domain.catalog import audit, coverage, upsert_stat_rows
from app.observability import record
from app.providers.nba import NBADataError, team_names
from app.schemas.stats import StatRow


def nba_team(session, code, names, fallback=None):
    if code is None:
        return None
    team = session.scalar(select(NBATeam).where(NBATeam.code == code))
    if team is None:
        # Unknown historical codes must not receive a modern franchise's name.
        session.execute(
            insert(NBATeam)
            .values(code=code, name=names.get(code) or fallback or f"NBA team ({code})")
            .on_conflict_do_nothing(index_elements=[NBATeam.code])
        )
        team = session.scalar(select(NBATeam).where(NBATeam.code == code))
    return team


def persist_player(session, metadata, seasons, actor_id, run_id):
    # Serialize competing provider jobs by NBA identity, including first insertion.
    session.execute(
        text("SELECT pg_advisory_xact_lock(658201, :nba_id)"),
        {"nba_id": metadata.nba_id},
    )
    mapping = session.scalar(
        select(ExternalPlayerID).where(
            ExternalPlayerID.provider == "nba",
            ExternalPlayerID.external_id == str(metadata.nba_id),
        )
    )
    if mapping:
        player = session.scalar(
            select(Player).where(Player.id == mapping.player_id).with_for_update()
        )
    else:
        unlinked = session.scalar(
            select(Player.id).where(
                func.lower(Player.name) == metadata.name.lower(),
                ~select(ExternalPlayerID.player_id)
                .where(
                    ExternalPlayerID.player_id == Player.id,
                    ExternalPlayerID.provider == "nba",
                )
                .exists(),
            )
        )
        if unlinked:
            raise NBADataError(
                "An unlinked player with this name exists. Set its external_ids.nba to "
                f"{metadata.nba_id} through the admin API before syncing."
            )
        player = Player(
            name=metadata.name,
            rookie_season=metadata.rookie_season,
            archived=True,
            tier=5,
            priority=1000000,
        )
        session.add(player)
        session.flush()
        session.add(
            ExternalPlayerID(
                player_id=player.id, provider="nba", external_id=str(metadata.nba_id)
            )
        )
    player.name = metadata.name
    player.rookie_season = metadata.rookie_season
    player.no_appearances = not any(
        s.totals.games for s in seasons if s.phase == "regular"
    )
    names = team_names()
    current_team = nba_team(session, metadata.team_code, names, metadata.team_name)
    player.nba_team_id = current_team.id if current_team else None
    rows = []
    for season in seasons:
        row = StatRow(
            player_id=player.id,
            season=season.season,
            phase=season.phase,
            scope=season.scope,
            totals=season.totals,
        )
        team = (
            None if season.scope == "TOTAL" else nba_team(session, season.scope, names)
        )
        rows.append((row, team))
    upsert_stat_rows(session, rows, run_id)
    session.flush()
    user = session.get(User, actor_id)
    audit(
        session,
        user,
        "nba.sync_player",
        player.id,
        {"nba_id": metadata.nba_id, "import_run_id": str(run_id), "rows": len(rows)},
    )
    return {
        "nba_id": metadata.nba_id,
        "player_id": str(player.id),
        "rows": len(rows),
        "coverage": coverage(session, player),
    }


def sync_nba(
    engine,
    firebase_uid,
    client,
    *,
    active=False,
    player_ids=(),
    offset=0,
    limit=None,
    on_progress=None,
):
    with Session(engine) as session, session.begin():
        actor = session.scalar(select(User).where(User.firebase_uid == firebase_uid))
        if not actor or not actor.is_admin:
            raise NBADataError(
                "An existing platform administrator's Firebase UID is required."
            )
        actor_id = actor.id
        run = ImportRun(
            actor_id=actor_id,
            source="nba_api:active" if active else "nba_api:career",
            status="running",
            row_count=0,
            errors=[],
        )
        session.add(run)
        session.flush()
        run_id = run.id
    synced, row_count, errors, consecutive = 0, 0, [], 0
    try:
        selected = (
            client.active_players() if active else list(dict.fromkeys(player_ids))
        )
        selected = selected[offset : offset + limit if limit is not None else None]
        if not selected:
            raise NBADataError("No players selected. Check IDs, offset and limit.")
        for item in selected:
            nba_id = item.nba_id if active else item
            try:
                metadata = item if active else client.player(nba_id)
                seasons = client.career(metadata)
                # Network calls finish before acquiring database locks.
                with Session(engine) as session, session.begin():
                    result = persist_player(
                        session, metadata, seasons, actor_id, run_id
                    )
                synced += 1
                row_count += result["rows"]
                consecutive = 0
                if on_progress:
                    on_progress({"status": "synced", **result})
            except (ValueError, KeyError, TypeError) as exc:
                consecutive += 1
                errors.append({"row": nba_id, "message": str(exc)[:1000]})
                record("import_failures")
                if on_progress:
                    on_progress(
                        {
                            "status": "failed",
                            "nba_id": nba_id,
                            "message": str(exc)[:1000],
                        }
                    )
                if consecutive >= 3:
                    errors.append(
                        {
                            "row": None,
                            "message": (
                                "Stopped after three consecutive failures; "
                                "remaining players were not attempted."
                            ),
                        }
                    )
                    break
    except (ValueError, KeyError, TypeError) as exc:
        errors.append({"row": None, "message": str(exc)[:1000]})
        record("import_failures")
    finally:
        # Also close reports after unexpected errors or operator interruption.
        import sys

        if sys.exc_info()[0] is not None:
            errors.append(
                {
                    "row": None,
                    "message": (
                        "Sync interrupted; previously committed players "
                        "remain available."
                    ),
                }
            )
        status = "partial" if errors and synced else "failed" if errors else "complete"
        with Session(engine) as session, session.begin():
            run = session.get(ImportRun, run_id)
            run.status, run.row_count, run.errors = status, row_count, errors
            audit(
                session,
                session.get(User, actor_id),
                "nba.sync",
                run_id,
                {"status": status, "synced": synced, "rows": row_count},
            )
    return {
        "id": str(run_id),
        "status": status,
        "synced": synced,
        "row_count": row_count,
        "errors": errors,
    }
