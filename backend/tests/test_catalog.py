import json

from conftest import headers
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.catalog import Totals
from app.db.catalog import PoolPlayer
from app.domain.catalog import current_season


def make_player(client, **changes):
    body = {
        "name": "Test Rookie",
        "rookie_season": current_season(),
        "no_appearances": True,
        "tier": 1,
        "priority": 1,
        "positions": ["PG", "SF"],
    }
    body.update(changes)
    response = client.post("/api/v1/admin/players", headers=headers(), json=body)
    assert response.status_code == 201, response.text
    return response.json()


def make_pool(client, ids):
    pool = client.post(
        "/api/v1/admin/pools", headers=headers(), json={"name": "Test pool"}
    ).json()
    result = client.put(
        f"/api/v1/admin/pools/{pool['id']}/players",
        headers=headers(),
        json={"player_ids": ids},
    )
    assert result.status_code == 200, result.text
    result = client.post(f"/api/v1/admin/pools/{pool['id']}/publish", headers=headers())
    assert result.status_code == 200, result.text
    return pool["id"]


def test_pool_history_and_permissions(db_app):
    app, client = db_app
    assert (
        client.post(
            "/api/v1/admin/players", headers=headers("alice"), json={}
        ).status_code
        == 403
    )
    player = make_player(client)
    pool_id = make_pool(client, [player["id"]])
    changes = {
        k: player[k]
        for k in (
            "name",
            "rookie_season",
            "no_appearances",
            "tier",
            "priority",
            "positions",
        )
    }
    changes.update(tier=5, positions=["C"])
    assert (
        client.put(
            f"/api/v1/admin/players/{player['id']}", headers=headers(), json=changes
        ).status_code
        == 200
    )
    frozen = client.get(f"/api/v1/pools/{pool_id}", headers=headers()).json()[
        "players"
    ][0]
    assert frozen["tier"] == 1 and set(frozen["positions"]) == {"PG", "SF"}
    assert (
        client.put(
            f"/api/v1/admin/pools/{pool_id}/players",
            headers=headers(),
            json={"player_ids": [player["id"]]},
        ).status_code
        == 409
    )
    with Session(app.state.engine) as session:
        entry = session.scalar(select(PoolPlayer))
        entry.tier = 4
        import pytest
        from sqlalchemy.exc import IntegrityError

        with pytest.raises(IntegrityError):
            session.commit()


def test_import_is_atomic_repeatable_and_keeps_splits(db_app):
    _, client = db_app
    player = make_player(client, no_appearances=False)
    assert not player["coverage"]["complete"]
    totals = {key: 0 for key in Totals.model_fields}
    totals.update(games=10, minutes=100, points=50)
    row = {
        "player_id": player["id"],
        "season": current_season(),
        "phase": "regular",
        "scope": "TOTAL",
        "totals": totals,
    }

    def upload(rows):
        return client.post(
            "/api/v1/admin/imports",
            headers=headers(),
            json={"source": "test fixture", "format": "json", "data": json.dumps(rows)},
        )

    bad = {**row, "season": current_season() - 1}
    assert upload([row, bad]).status_code == 422
    history_url = f"/api/v1/players/{player['id']}/history"
    assert client.get(history_url, headers=headers()).json()["seasons"] == []
    client.post(
        "/api/v1/admin/nba-teams",
        headers=headers(),
        json={"code": "TST", "name": "Test team"},
    )
    for _ in range(2):
        assert upload([row, {**row, "scope": "TST"}]).status_code == 200
    history = client.get(history_url, headers=headers()).json()
    assert history["coverage"]["complete"]
    assert len(history["seasons"]) == 2
    assert history["seasons"][0]["averages"]["points"] == 5
    assert history["seasons"][0]["percentages"]["fg"] is None
    assert client.get(f"/api/v1/players/{player['id']}", headers=headers()).json()[
        "positions"
    ] == ["PG", "SF"]


def test_csv_and_career_gap_validation(db_app):
    import csv
    import io

    _, client = db_app
    player = make_player(
        client, rookie_season=current_season() - 2, no_appearances=False
    )
    assert len(player["coverage"]["missing_seasons"]) == 3
    fields = ["player_id", "season", "phase", "scope", *Totals.model_fields]
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=fields)
    writer.writeheader()
    for season in range(current_season() - 2, current_season() + 1):
        writer.writerow(
            {
                "player_id": player["id"],
                "season": season,
                "phase": "regular",
                "scope": "TOTAL",
                **{k: 0 for k in Totals.model_fields},
            }
        )

    def upload(data):
        return client.post(
            "/api/v1/admin/imports",
            headers=headers(),
            json={"source": "Synthetic CSV fixture", "format": "csv", "data": data},
        )

    assert upload(buffer.getvalue()).status_code == 200
    history = client.get(
        f"/api/v1/players/{player['id']}/history", headers=headers()
    ).json()
    assert history["coverage"]["complete"]
    assert history["seasons"][0]["averages"]["points"] is None
    malformed = buffer.getvalue().replace("player_id,", "player_id,player_id,", 1)
    assert upload(malformed).status_code == 422
    assert (
        client.post(
            "/api/v1/admin/nba-teams",
            headers=headers(),
            json={"code": "TOTAL", "name": "Invalid"},
        ).status_code
        == 422
    )
