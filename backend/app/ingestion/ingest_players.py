import logging

from app.core.logging import setup_logging

from nba_api.stats.static import players
from app.schema.player import Player
from app.schema.base import SessionLocal

from sqlalchemy import select

logger = logging.getLogger(__name__)

all_players = players.get_active_players()


def ingest_players():
    logger.info("Starting players ingestion: %d records", len(all_players))
    inserted = 0
    skipped = 0
    try:
        with SessionLocal.begin() as session:
            for player in all_players:
                new_player = session.scalar(
                    select(Player).where(Player.id == player["id"])
                )

                if new_player is None:
                    new_player = Player()

                    new_player.id = player["id"]
                    new_player.first_name = player["first_name"]
                    new_player.last_name = player["last_name"]
                    new_player.full_name = player["full_name"]
                    new_player.is_active = player["is_active"]

                    session.add(new_player)
                    inserted += 1
                else:
                    skipped += 1
    except Exception:
        logger.exception("Players ingestion failed; transaction rolled back")
        raise

    logger.info(
        "Players ingestion complete: %d inserted, %d already existed",
        inserted,
        skipped,
    )


if __name__ == "__main__":
    setup_logging()
    ingest_players()