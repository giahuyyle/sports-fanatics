"""Synthetic NBA endpoint rows; tests make no live network requests."""

from types import SimpleNamespace

import pytest
from requests import Timeout

from app.domain.catalog import current_season
from app.providers.nba import (
    STAT_FIELDS,
    NBAClient,
    NBADataError,
    NBAPlayer,
    season_rows,
)


def metadata(nba_id=100):
    return NBAPlayer(
        nba_id,
        f"Synthetic Player {nba_id}",
        current_season() - 1,
        "AAA",
        "Example A",
        True,
    )


def stat_row(year=None, code="AAA", team_id=7, games=10, points=100, nba_id=100):
    year = current_season() if year is None else year
    row = {field: 0 for field in STAT_FIELDS.values()}
    row.update(
        PLAYER_ID=nba_id,
        LEAGUE_ID="00",
        SEASON_ID=f"{year}-{(year + 1) % 100:02d}",
        TEAM_ID=team_id,
        TEAM_ABBREVIATION=code,
        GP=games,
        PTS=points,
        MIN=games * 20,
    )
    return row


def career(player=None):
    player = player or metadata()
    rows = [
        stat_row(current_season() - 1, nba_id=player.nba_id),
        stat_row(nba_id=player.nba_id),
        stat_row(code="BBB", team_id=8, points=200, nba_id=player.nba_id),
        stat_row(code="2TM", team_id=0, games=20, points=300, nba_id=player.nba_id),
    ]
    return season_rows(
        player, rows, [stat_row(games=2, points=30, nba_id=player.nba_id)]
    )


def test_totals_splits_and_playoffs_stay_separate():
    rows = career()
    current = [r for r in rows if r.season == current_season() and r.phase == "regular"]
    assert len(current) == 3
    assert next(r for r in current if r.scope == "TOTAL").totals.points == 300
    previous = [r for r in rows if r.season == current_season() - 1]
    assert {r.scope for r in previous} == {"AAA", "TOTAL"}
    assert (
        next(
            r for r in rows if r.phase == "playoffs" and r.scope == "TOTAL"
        ).totals.games
        == 2
    )


@pytest.mark.parametrize(
    "changes",
    [
        {"PLAYER_ID": 999},
        {"LEAGUE_ID": "10"},
        {"PTS": None},
        {"SEASON_ID": "2026-28"},
        {"FGM": 3, "FGA": 1},
    ],
)
def test_invalid_upstream_rows_are_rejected(changes):
    with pytest.raises((ValueError, TypeError)):
        season_rows(metadata(), [{**stat_row(), **changes}], [])


def test_missing_aggregate_and_missing_career_are_not_zero_filled():
    with pytest.raises(NBADataError, match="aggregate"):
        season_rows(metadata(), [stat_row(), stat_row(code="BBB", team_id=8)], [])
    assert season_rows(metadata(), [], []) == []
    rookie = NBAPlayer(200, "Synthetic Rookie", current_season(), None, None, False)
    assert season_rows(rookie, [], []) == []
    # A missing intervening season stays missing for coverage reporting.
    assert {r.season for r in season_rows(metadata(), [stat_row()], [])} == {
        current_season()
    }


def test_retries_are_bounded_and_transient_timeouts_can_recover(monkeypatch):
    monkeypatch.setattr("app.providers.nba.time.sleep", lambda _: None)
    calls = []

    def temporary(**kwargs):
        calls.append(kwargs)
        if len(calls) < 2:
            raise Timeout("synthetic timeout")
        return "ok"

    assert NBAClient(retries=2)._request(temporary, player_id=100) == "ok"
    assert len(calls) == 2
    calls.clear()

    def unavailable(**kwargs):
        calls.append(kwargs)
        raise Timeout("synthetic timeout")

    with pytest.raises(NBADataError, match="after 3 attempts"):
        NBAClient(retries=2)._request(unavailable)
    assert len(calls) == 3


def test_active_discovery_uses_current_rosters(monkeypatch):
    def endpoint(**kwargs):
        assert kwargs["league_id"] == "00" and kwargs["is_only_current_season"] == 1
        row = {
            "PERSON_ID": 100,
            "FROM_YEAR": str(current_season() - 1),
            "DISPLAY_FIRST_LAST": "Synthetic Player",
            "TEAM_ID": 7,
            "TEAM_CITY": "Example",
            "TEAM_NAME": "A",
            "TEAM_ABBREVIATION": "AAA",
            "GAMES_PLAYED_FLAG": "Y",
            "ROSTERSTATUS": 1,
        }
        other = {**row, "PERSON_ID": 200, "ROSTERSTATUS": 0}
        data = {
            "headers": list(row),
            "data": [list(row.values()), list(other.values())],
        }
        return SimpleNamespace(
            common_all_players=SimpleNamespace(get_dict=lambda: data)
        )

    monkeypatch.setattr("app.providers.nba.commonallplayers.CommonAllPlayers", endpoint)
    assert [p.nba_id for p in NBAClient().active_players()] == [100]
