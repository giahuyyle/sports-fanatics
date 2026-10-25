"""nba_api adapter: bounded, paced network calls and strict season-total mapping."""

import time
from dataclasses import dataclass
from typing import Literal

from nba_api.stats.endpoints import (
    commonallplayers,
    commonplayerinfo,
    playercareerstats,
)
from nba_api.stats.static import teams
from requests import RequestException

from app.domain.catalog import current_season
from app.schemas.stats import Totals

STAT_FIELDS = {
    "games": "GP",
    "starts": "GS",
    "minutes": "MIN",
    "points": "PTS",
    "rebounds": "REB",
    "assists": "AST",
    "steals": "STL",
    "blocks": "BLK",
    "turnovers": "TOV",
    "fouls": "PF",
    "fg_made": "FGM",
    "fg_attempted": "FGA",
    "three_made": "FG3M",
    "three_attempted": "FG3A",
    "ft_made": "FTM",
    "ft_attempted": "FTA",
}


class NBADataError(ValueError):
    pass


class NBAUnavailableError(NBADataError):
    """A failed upstream request, distinct from an invalid player record."""


@dataclass(frozen=True)
class NBAPlayer:
    nba_id: int
    name: str
    rookie_season: int
    team_code: str | None
    team_name: str | None
    games_played: bool


@dataclass(frozen=True)
class NBASeason:
    season: int
    phase: Literal["regular", "playoffs"]
    scope: str
    totals: Totals


def records(dataset):
    body = dataset.get_dict()
    headers, values = body["headers"], body["data"]
    if not headers or len(headers) != len(set(headers)):
        raise NBADataError("Upstream dataset has invalid column headers")
    return [dict(zip(headers, row, strict=True)) for row in values]


def player_metadata(row):
    nba_id = int(row["PERSON_ID"])
    year = int(row["FROM_YEAR"])
    name = row["DISPLAY_FIRST_LAST"].strip()
    if not 0 < nba_id < 2**31 or not 1946 <= year <= current_season() or not name:
        raise NBADataError("Upstream player identity or rookie season is invalid")
    team_id = int(row["TEAM_ID"])
    if team_id < 0:
        raise NBADataError("Upstream team identity is invalid")
    code = row.get("TEAM_ABBREVIATION") if team_id else None
    if team_id and (
        not isinstance(code, str)
        or not code.isalnum()
        or not code.isupper()
        or len(code) > 12
    ):
        raise NBADataError("Upstream current-team code is invalid")
    flag = str(row["GAMES_PLAYED_FLAG"]).upper()
    if flag not in ("Y", "N"):
        raise NBADataError("Upstream appearance status is missing")
    team_name = " ".join(
        str(row.get(k) or "").strip() for k in ("TEAM_CITY", "TEAM_NAME")
    ).strip()
    return NBAPlayer(
        nba_id,
        name,
        year,
        code,
        team_name or code,
        flag == "Y",
    )


def season_rows(player, regular, playoffs):
    """Keep NBA aggregate rows separate from stints; copy single-team totals only."""
    result, seen, grouped = [], set(), {}
    for phase, rows in (("regular", regular), ("playoffs", playoffs)):
        for row in rows:
            if int(row["PLAYER_ID"]) != player.nba_id or str(row["LEAGUE_ID"]) != "00":
                raise NBADataError(
                    "Upstream career row belongs to a different player or league"
                )
            text = str(row["SEASON_ID"])
            year = int(text[:4])
            if (
                text != f"{year}-{(year + 1) % 100:02d}"
                or not player.rookie_season <= year <= current_season()
            ):
                raise NBADataError("Upstream career season is invalid")
            scope = (
                "TOTAL" if int(row["TEAM_ID"]) == 0 else str(row["TEAM_ABBREVIATION"])
            )
            if scope != "TOTAL" and (
                not scope.isalnum() or not scope.isupper() or len(scope) > 12
            ):
                raise NBADataError("Upstream NBA team code is invalid")
            key = (year, phase, scope)
            if key in seen:
                raise NBADataError("Upstream returned duplicate season/team totals")
            seen.add(key)
            # Missing metrics are errors, never invented zeroes.
            totals = Totals.model_validate(
                {key: row[source] for key, source in STAT_FIELDS.items()}
            )
            item = NBASeason(year, phase, scope, totals)
            result.append(item)
            grouped.setdefault((year, phase), []).append(item)
    for (year, phase), rows in grouped.items():
        if not any(row.scope == "TOTAL" for row in rows):
            if len(rows) != 1:
                raise NBADataError(
                    "Traded-player season is missing its aggregate total"
                )
            result.append(NBASeason(year, phase, "TOTAL", rows[0].totals))
    return result


class NBAClient:
    def __init__(self, timeout=20.0, retries=2, delay=1.0):
        self.timeout, self.retries, self.delay = timeout, retries, delay
        self.last_request = None

    def _request(self, factory, **parameters):
        for attempt in range(self.retries + 1):
            if self.last_request is not None:
                time.sleep(max(0, self.delay - (time.monotonic() - self.last_request)))
            self.last_request = time.monotonic()
            try:
                return factory(timeout=self.timeout, **parameters)
            except (RequestException, ValueError, KeyError) as error:
                # JSON decode errors can represent a transient NBA HTML error response.
                if attempt == self.retries:
                    raise NBAUnavailableError(
                        f"NBA endpoint unavailable after {attempt + 1} attempts "
                        f"({type(error).__name__})"
                    ) from error
                time.sleep(min(2**attempt, 8))
        raise AssertionError("Unreachable retry state")

    def active_players(self):
        year = current_season()
        response = self._request(
            commonallplayers.CommonAllPlayers,
            is_only_current_season=1,
            league_id="00",
            season=f"{year}-{(year + 1) % 100:02d}",
        )
        rows = records(response.common_all_players)
        players = [
            player_metadata(row) for row in rows if int(row["ROSTERSTATUS"]) == 1
        ]
        if not players or len({p.nba_id for p in players}) != len(players):
            raise NBADataError(
                "Upstream active-player catalog is empty or has duplicate IDs"
            )
        return sorted(players, key=lambda p: p.nba_id)

    def player(self, nba_id):
        response = self._request(
            commonplayerinfo.CommonPlayerInfo, player_id=nba_id, league_id_nullable="00"
        )
        rows = records(response.common_player_info)
        if len(rows) != 1:
            raise NBADataError("Upstream player metadata is missing or ambiguous")
        player = player_metadata(rows[0])
        if player.nba_id != nba_id:
            raise NBADataError("Upstream returned the wrong player identity")
        return player

    def career(self, player):
        response = self._request(
            playercareerstats.PlayerCareerStats,
            player_id=player.nba_id,
            per_mode36="Totals",
            league_id_nullable="00",
        )
        return season_rows(
            player,
            records(response.season_totals_regular_season),
            records(response.season_totals_post_season),
        )


def team_names():
    return {team["abbreviation"]: team["full_name"] for team in teams.get_teams()}
