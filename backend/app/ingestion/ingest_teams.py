import logging

from app.core.logging import setup_logging

from nba_api.stats.static import teams
from app.schema.team import Team
from app.schema.base import SessionLocal

from sqlalchemy import select

logger = logging.getLogger(__name__)

all_teams = teams.get_teams()

def ingest_teams():
    logger.info("Starting teams ingestion: %d records", len(all_teams))
    inserted = 0
    skipped = 0
    try:
        with SessionLocal.begin() as session:
            for team in all_teams:
                new_team = session.scalar(
                    select(Team).where(Team.id == team["id"])
                )

                if new_team is None:
                    new_team = Team()

                    new_team.id = team["id"]
                    new_team.full_name = team["full_name"]
                    new_team.abbreviation = team["abbreviation"]
                    new_team.nick_name = team["nickname"]
                    new_team.city = team["city"]
                    new_team.state = team["state"]
                    new_team.year_founded = team["year_founded"]

                    session.add(new_team)
                    inserted += 1
                else:
                    skipped += 1
    except Exception:
        logger.exception("Teams ingestion failed; transaction rolled back")
        raise

    logger.info(
        "Teams ingestion complete: %d inserted, %d already existed",
        inserted,
        skipped,
    )


if __name__ == "__main__":
    setup_logging()
    ingest_teams()