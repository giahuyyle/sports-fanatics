import pytest

from app.providers.nba import NBAPlayer
from scripts.refresh_demo_affiliations import refreshed_players


def test_refresh_changes_team_without_replacing_sample_statistics_or_local_id():
    row = {
        "id": 900026,
        "nbaId": 203076,
        "name": "Anthony Davis",
        "team": "OLD",
        "points": 24.7,
        "rank": 26,
        "position": "PF",
        "image": False,
    }
    identity = NBAPlayer(203076, "Anthony Davis", 2012, "NEW", "Example team", True)
    updated = refreshed_players([row], {203076: identity})[0]
    assert updated == {**row, "team": "NEW"}
    assert row["team"] == "OLD"


def test_duplicate_or_mismatched_nba_identity_cannot_assign_another_players_team():
    row = {"id": 1628983, "name": "Mikal Bridges", "team": "OLD"}
    shai = NBAPlayer(
        1628983, "Shai Gilgeous-Alexander", 2018, "OKC", "Oklahoma City", True
    )
    with pytest.raises(ValueError, match="identity mismatch"):
        refreshed_players([row], {1628983: shai})
    with pytest.raises(ValueError, match="Duplicate local"):
        refreshed_players([row, row], {})
