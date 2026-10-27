from nba_api.stats.static import players
from app.schema.player import Player
from app.schema.base import SessionLocal

from sqlalchemy import select

all_players = players.get_active_players()


def ingest_players():
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

    session.flush()
    return

if __name__ == "__main__":
    ingest_players()