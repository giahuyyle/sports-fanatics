from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from app.db.catalog import AuditLog, SeasonStats

POSITIONS = ("PG", "SG", "SF", "PF", "C")


def current_season():
    now = datetime.now(UTC)
    return now.year if now.month >= 7 else now.year - 1


def coverage(session, player):
    rows = session.scalars(
        select(SeasonStats).where(
            SeasonStats.player_id == player.id,
            SeasonStats.scope == "TOTAL",
            SeasonStats.phase == "regular",
        )
    ).all()
    seasons = {r.season for r in rows}
    missing = [
        s for s in range(player.rookie_season, current_season() + 1) if s not in seasons
    ]
    valid_rookie = (
        player.no_appearances
        and player.rookie_season == current_season()
        and not any(r.totals["games"] for r in rows)
    )
    if valid_rookie:
        missing = []
    return {
        "complete": not missing,
        "missing_seasons": missing,
        "no_appearances": valid_rookie,
    }


def audit(session, user, action, target, details=None):
    session.add(
        AuditLog(
            actor_id=user.id, action=action, target=str(target), details=details or {}
        )
    )


def upsert_stat_rows(session, rows, import_run_id):
    """Shared by validated file imports and provider syncs; caller owns transaction."""
    for row, team in rows:
        values = row.model_dump(exclude={"totals"})
        values.update(
            totals=row.totals.model_dump(),
            import_run_id=import_run_id,
            nba_team_id=team.id if team else None,
        )
        statement = insert(SeasonStats).values(**values)
        session.execute(
            statement.on_conflict_do_update(
                index_elements=["player_id", "season", "phase", "scope"],
                set_={
                    k: statement.excluded[k]
                    for k in ("totals", "import_run_id", "nba_team_id")
                },
            )
        )
