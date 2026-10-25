"""Refresh current demo team labels without replacing historical sample statistics.

Run from backend/: uv run python -m scripts.refresh_demo_affiliations
"""

import argparse
import json
import unicodedata
from datetime import UTC, datetime
from pathlib import Path

from app.domain.catalog import current_season
from app.providers.nba import NBAClient

ROOT = Path(__file__).resolve().parents[2]


def normalized_name(value):
    return "".join(
        c for c in unicodedata.normalize("NFKD", value).casefold() if c.isalnum()
    )


def refreshed_players(rows, identities):
    if len({row["id"] for row in rows}) != len(rows):
        raise ValueError(
            "Duplicate local player IDs must be corrected before refreshing teams"
        )
    updated = []
    nba_ids = set()
    for row in rows:
        nba_id = row.get("nbaId", row["id"])
        if nba_id in nba_ids:
            raise ValueError("Two demo players resolve to the same NBA identity")
        nba_ids.add(nba_id)
        identity = identities[nba_id]
        if normalized_name(row["name"]) != normalized_name(identity.name):
            raise ValueError(f"NBA identity mismatch for {row['name']} ({nba_id})")
        updated.append({**row, "team": identity.team_code or "FA"})
    return updated


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--players", type=Path, default=ROOT / "frontend/src/state/players.json"
    )
    parser.add_argument(
        "--metadata",
        type=Path,
        default=ROOT / "frontend/src/state/player-affiliations.json",
    )
    args = parser.parse_args()
    original = json.loads(args.players.read_text())
    client = NBAClient()
    identities = {p.nba_id: p for p in client.active_players()}
    for row in original:
        nba_id = row.get("nbaId", row["id"])
        if nba_id not in identities:
            identities[nba_id] = client.player(nba_id)
    updated = refreshed_players(original, identities)
    year = current_season()
    metadata = {
        "season": f"{year}-{(year + 1) % 100:02d}",
        "verifiedAt": datetime.now(UTC).isoformat(),
        "source": "https://stats.nba.com/stats/commonallplayers",
        "library": "nba_api",
        "statisticsSeason": "2024-25",
    }
    # Validate every identity before changing either snapshot file.
    args.players.write_text(json.dumps(updated, ensure_ascii=False, indent=2) + "\n")
    args.metadata.write_text(json.dumps(metadata, indent=2) + "\n")
    changes = [
        {"name": old["name"], "from": old["team"], "to": new["team"]}
        for old, new in zip(original, updated, strict=True)
        if old["team"] != new["team"]
    ]
    print(
        json.dumps(
            {"verified_players": len(updated), "team_changes": changes},
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
