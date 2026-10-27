import logging
import time

from requests.exceptions import ConnectionError, Timeout
from nba_api.stats.endpoints import playercareerstats
from nba_api.stats.static import players

from app.schema.base import SessionLocal
from app.core.logging import setup_logging
from app.schema.season import Season
# registers Player model so Season object can have reference to the foreign key
from app.schema.player import Player

from sqlalchemy import select

logger = logging.getLogger(__name__)

"""
example of how to get a player's career stats
here, donovan mitchell

career = playercareerstats.PlayerCareerStats(player_id=1628378)  # sends the request

df = career.season_totals_regular_season.get_data_frame()
df[["SEASON_ID", "TEAM_ABBREVIATION", "PTS"]].tail(3)

print(df)
#   SEASON_ID TEAM_ABBREVIATION   PTS
# 6   2023-24               CLE  1463
# 7   2024-25               CLE  1701
# 8   2025-26               CLE  1952
"""

"""
steps to get a players stats: 
1. get list of players id's - preferrably use static data instead of reading from database, since data is valid
2. run the function playercareerstats.PlayerCareerStats(player_id=player_id) to get the stats
3. process stats season-by-season, add new season to the db
"""

def get_player_ids() -> list[int]:
    all_players = players.get_active_players()
    player_ids = [player["id"] for player in all_players]

    return player_ids

def get_player_season_stats(player_id: int) -> list[dict]:
    for attempt in range(1, 4):
        raw_stats = playercareerstats.PlayerCareerStats(
            player_id=player_id, timeout=60, get_request=False
        )
        try:
            raw_stats.get_request()
            break
        except KeyError:
            if (
                raw_stats.nba_response is not None
                and raw_stats.nba_response.get_dict() == {}
            ):
                logger.warning(
                    "Skipping player %s: career-stats API returned an empty response",
                    player_id,
                )
                return []
            raise
        except (Timeout, ConnectionError):
            if attempt == 3:
                raise
            delay = 2 ** attempt
            logger.warning(
                "Request failed for player %s (attempt %d/3); retrying in %ds",
                player_id, attempt, delay,
            )
            time.sleep(delay)
    raw_stats_dict = raw_stats.season_totals_regular_season.get_dict()

    processed_stats = []
    for row in raw_stats_dict["data"]:
        # zip(headers, row, strict=True) pairs each header with its corresponding value
        # ("PLAYER_ID", 203471)
        # ("SEASON_ID", "2025-26")
        # ("PTS", 756)

        # header.lower(): value creates the dictionary entries
        # stats = {
        #     "player_id": 203471,
        #     "season_id": "2025-26",
        #     "pts": 756,
        # }

        stats = {
            header.lower(): value
            for header, value in zip(raw_stats_dict["headers"], row, strict=True)
        }
        games = stats["gp"]
        for average, total in {
            "ppg": "pts",
            "apg": "ast",
            "rpg": "reb",
            "orpg": "oreb",
            "drpg": "dreb",
        }.items():
            stats[average] = stats[total] / games if games else 0.0
        processed_stats.append(stats)

    return processed_stats


def ingest_season_stats():
    player_ids = get_player_ids()
    failed_ids = []
    for index, player_id in enumerate(player_ids, start=1):
        if index > 1:
            time.sleep(1)
        logger.info("Fetching player %s (%d/%d)", player_id, index, len(player_ids))
        try:
            player_stats = get_player_season_stats(player_id)
        except (Timeout, ConnectionError):
            logger.exception("Skipping player %s after 3 failed requests", player_id)
            failed_ids.append(player_id)
            continue
        with SessionLocal.begin() as session:
            for stats in player_stats:
                season = session.scalar(
                    select(Season).where(
                        Season.player_id == stats["player_id"],
                        Season.season_id == stats["season_id"],
                        Season.league_id == stats["league_id"],
                        Season.team_id == stats["team_id"],
                    )
                )

                if season is None:
                    season = Season()
                    session.add(season)

                for field, value in stats.items():
                    setattr(season, field, value)

                # make this row visible to subsequent lookups even with autoflush=False.
                session.flush()

        logger.info("Saved %d season rows for player %s", len(player_stats), player_id)

    if failed_ids:
        raise RuntimeError(f"Season ingestion incomplete; failed player IDs: {failed_ids}")
    logger.info("Season ingestion complete for %d players", len(player_ids))


if __name__ == "__main__":
    setup_logging()
    ingest_season_stats()


"""
options for shape of raw data:
1. df
2. json
3. dict

- current choice: dict
- dict structure:
    1. key: 'headers' - val: list of attributes
    2. key: 'data'    - val: actual data corresponding to each attribute

jb3 = get_player_season_stats(202710)["data"]

edge case: a player might be traded mid-season => 2+ stats data for that season
=> preprocess dict into readable data/json(?)

THE FUNCTION BELOW IS USED FOR AGGREGATING SEASONS, NOT FOR HANDLING INGESTION
"""
# def get_player_season_stats(player_id: int) -> dict:
#     raw_stats = playercareerstats.PlayerCareerStats(player_id=player_id)
#     raw_stats_dict = raw_stats.season_totals_regular_season.get_dict()

#     headers = raw_stats_dict["headers"]
#     raw_data = raw_stats_dict["data"]

#     # key: season  - val: list of dicts containing headers and corresponding values
#     stats_dict = defaultdict(list)

#     for data in raw_data:
#         d = {}
#         season = ""

#         for i in range(len(headers)):
#             attr = headers[i]
#             val = data[i]

#             if attr in {"SEASON_ID", }:
#                 season = val

#             d[attr] = val

#         stats_dict[season].append(d)

#     return stats_dict

