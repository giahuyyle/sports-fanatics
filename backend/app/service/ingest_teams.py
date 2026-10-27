from nba_api.stats.static import teams
from app.schema.team import Team
from app.schema.base import SessionLocal

from sqlalchemy import select

all_teams = teams.get_teams()

def ingest_teams():
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

    session.flush()
    return

if __name__ == "__main__":
    ingest_teams()