"""Curated game catalog and historical membership queries."""
import json
from itertools import combinations
from random import SystemRandom
import unicodedata
from pathlib import Path
from sqlalchemy import select
from app.schema.player import Player
from app.schema.team import Team
from app.schema.season import Season

DATA = json.loads((Path(__file__).with_name("game_data.json")).read_text())


def normalize(value: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", value).casefold()
                   if c.isalpha() and not unicodedata.combining(c))


def player_map(session):
    return {normalize(p.full_name): p for p in session.scalars(select(Player)).all()}


def catalog(session):
    players = player_map(session)
    missing = []
    pool = []
    for entry in DATA["players"]:
        player = players.get(normalize(entry["name"]))
        if player is None:
            missing.append(entry["name"])
            continue
        pool.append({"id": player.id, "name": player.full_name,
                     "team": entry["team"], "position": entry["pos"], "rank": entry["rank"]})
    puzzles = []
    for i, mystery in enumerate(DATA["mysteries"]):
        if normalize(mystery["name"]) in players:
            puzzles.append({"id": str(i), "clues": mystery["clues"]})
        else:
            missing.append(mystery["name"])
    return {"players": pool, "puzzles": puzzles,
            "unavailable": sorted(set(missing)), "rankingLabel": "Demo rankings"}


def distinct_answers(cells):
    """Find a matching of cells to players without revealing the answers."""
    owners = {}
    def assign(cell, visited):
        for player in cells[cell]:
            if player in visited:
                continue
            visited.add(player)
            if player not in owners or assign(owners[player], visited):
                owners[player] = cell
                return True
        return False
    return all(assign(cell, set()) for cell in sorted(range(len(cells)), key=lambda i: len(cells[i])))


def random_grid(session, previous=""):
    teams = {team.id: team for team in session.scalars(select(Team)).all()}
    histories = {}
    for player_id, team_id in session.execute(select(Season.player_id, Season.team_id).join(
        Player, Player.id == Season.player_id).where(
            Season.team_id != 0, Season.league_id == "00", Season.gp > 0)):
        if team_id in teams:
            histories.setdefault(team_id, set()).add(player_id)
    if len(set().union(*histories.values())) < 9:
        return None
    ids = list(histories)
    rng = SystemRandom()
    rng.shuffle(ids)
    for rows in combinations(ids, 3):
        candidates = [col for col in ids if col not in rows
                      and all(histories[row] & histories[col] for row in rows)]
        rng.shuffle(candidates)
        for columns in combinations(candidates, 3):
            cells = [histories[row] & histories[col] for row in rows for col in columns]
            if not distinct_answers(cells):
                continue
            row_ids, col_ids = list(rows), list(columns)
            rng.shuffle(row_ids)
            rng.shuffle(col_ids)
            signature = ",".join(map(str, row_ids + col_ids))
            if signature == previous:
                col_ids = col_ids[1:] + col_ids[:1]
            def serialize(team_id):
                team = teams[team_id]
                return {"id": team.id, "name": team.nick_name, "abbreviation": team.abbreviation}
            return {"rows": list(map(serialize, row_ids)), "columns": list(map(serialize, col_ids))}
    return None



def matches_teams(session, player_id, team_ids):
    history = set(session.scalars(select(Season.team_id).where(
        Season.player_id == player_id, Season.team_id.in_(team_ids),
        Season.team_id != 0, Season.league_id == "00", Season.gp > 0)).all())
    return set(team_ids).issubset(history)
