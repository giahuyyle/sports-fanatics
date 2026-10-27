from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.schema.season import Season

SeasonScope = Literal["overall", "teams", "all"]


def get_player_seasons(
    session: Session,
    player_id: int,
    season_id: str | None = None,
    scope: SeasonScope = "overall",
) -> list[Season]:
    query = select(Season).where(Season.player_id == player_id)
    if season_id is not None:
        query = query.where(Season.season_id == season_id)
    rows = list(session.scalars(
        query.order_by(Season.season_id.desc(), Season.league_id, Season.team_id)
    ).all())
    if scope == "all":
        return rows
    if scope == "teams":
        return [row for row in rows if row.team_id != 0]
    # Prefer aggregate rows within each season and league.
    aggregates = {(row.season_id, row.league_id) for row in rows if row.team_id == 0}
    return [row for row in rows if row.team_id == 0
            or (row.season_id, row.league_id) not in aggregates]
