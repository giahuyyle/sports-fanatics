from concurrent.futures import ThreadPoolExecutor
from uuid import UUID, uuid4

import pytest
from conftest import headers
from sqlalchemy.orm import Session
from test_catalog import make_player, make_pool

from app.db.draft import Draft


def setup_league(client, count=2):
    players = [
        make_player(
            client,
            name=f"Fixture {t}-{i}",
            tier=t,
            priority=t * 100 + i,
            positions=["PG", "SG", "SF", "PF", "C"],
        )
        for t in range(1, 6)
        for i in range(2 * count)
    ]
    pool_id = make_pool(client, [p["id"] for p in players])
    for i in range(count):
        assert (
            client.post(
                "/api/v1/me/team",
                headers=headers(f"user{i}"),
                json={"name": f"Team {i}"},
            ).status_code
            == 201
        )
    result = client.post(
        "/api/v1/leagues",
        headers=headers("user0"),
        json={"name": "Fixture league", "pool_id": pool_id, "capacity": count},
    )
    assert result.status_code == 201, result.text
    league = result.json()
    managers = {league["entries"][0]["id"]: "user0"}
    for i in range(1, count):
        joined = client.post(
            "/api/v1/leagues/join",
            headers=headers(f"user{i}"),
            json={"invite_code": league["invite_code"]},
        )
        assert joined.status_code == 200, joined.text
        for entry in joined.json()["entries"]:
            if entry["name"] == f"Team {i}":
                managers[entry["id"]] = f"user{i}"
    started = client.post(
        f"/api/v1/leagues/{league['id']}/start", headers=headers("user0")
    )
    assert started.status_code == 200, started.text
    return started.json(), managers


def next_request(app, state):
    with Session(app.state.engine) as session:
        draft = session.get(Draft, UUID(state["id"]))
        taken = {p["pool_player_id"] for p in state["picks"]}
        assignments = draft.completion[state["draft"]["current_entry_id"]]
        player = next(p for p in assignments if p not in taken)
        return {
            "pool_player_id": player,
            "expected_revision": draft.revision,
            "idempotency_key": str(uuid4()),
        }


@pytest.mark.parametrize("count", [2, 4, 6])
def test_full_drafts_and_lineup_edits(db_app, count):
    app, client = db_app
    state, managers = setup_league(client, count)
    url = f"/api/v1/leagues/{state['id']}"
    assert client.get(url, headers=headers("outsider")).status_code == 403
    for _ in range(count * 10):
        manager = managers[state["draft"]["current_entry_id"]]
        body = next_request(app, state)
        response = client.post(url + "/picks", headers=headers(manager), json=body)
        assert response.status_code == 200, response.text
        # Network retry returns the original pick, even after the turn advanced.
        assert (
            client.post(url + "/picks", headers=headers(manager), json=body).json()[
                "id"
            ]
            == response.json()["id"]
        )
        state = client.get(url, headers=headers("user0")).json()
    assert state["status"] == "complete"
    assert len(state["picks"]) == count * 10
    assert len(state["lineups"]) == count * 10
    entry = next(e for e, uid in managers.items() if uid == "user0")
    picks = {p["id"]: p["pool_player_id"] for p in state["picks"]}
    slots = [
        {
            "role": "bench" if s["role"] == "starter" else "starter",
            "position": s["position"],
            "pool_player_id": picks[s["pick_id"]],
        }
        for s in state["lineups"]
        if s["entry_id"] == entry
    ]
    assert (
        client.put(
            url + "/lineup", headers=headers("user0"), json={"slots": slots}
        ).status_code
        == 200
    )
    slots[0]["pool_player_id"] = slots[1]["pool_player_id"]
    assert (
        client.put(
            url + "/lineup", headers=headers("user0"), json={"slots": slots}
        ).status_code
        == 422
    )


def test_concurrent_picks_one_turn(db_app):
    app, client = db_app
    state, managers = setup_league(client)
    manager = managers[state["draft"]["current_entry_id"]]
    body = next_request(app, state)
    url = f"/api/v1/leagues/{state['id']}/picks"

    def submit(key):
        return client.post(
            url, headers=headers(manager), json={**body, "idempotency_key": key}
        ).status_code

    with ThreadPoolExecutor(max_workers=2) as executor:
        assert sorted(executor.map(submit, [str(uuid4()), str(uuid4())])) == [200, 409]


def test_league_authorization_and_conflicts(db_app):
    app, client = db_app
    state, managers = setup_league(client)
    url = f"/api/v1/leagues/{state['id']}"
    owner = "user0"
    manager = managers[state["draft"]["current_entry_id"]]
    other = next(uid for uid in managers.values() if uid != manager)
    body = next_request(app, state)
    assert (
        client.post(url + "/picks", headers=headers(other), json=body).status_code
        == 403
    )
    assert (
        client.post(
            url + "/picks",
            headers=headers(manager),
            json={**body, "expected_revision": 999},
        ).status_code
        == 409
    )
    assert (
        client.post(
            url + "/picks",
            headers=headers(manager),
            json={**body, "pool_player_id": str(uuid4())},
        ).status_code
        == 422
    )
    assert (
        client.put(
            url + "/queue",
            headers=headers(manager),
            json={"pool_player_ids": [body["pool_player_id"]] * 2},
        ).status_code
        == 422
    )
    result = client.post(url + "/picks", headers=headers(manager), json=body)
    assert result.status_code == 200
    assert (
        client.post(
            url + "/picks",
            headers=headers(manager),
            json={**body, "pool_player_id": str(uuid4())},
        ).json()["error"]["code"]
        == "idempotency_conflict"
    )
    assert client.post(url + "/start", headers=headers("user1")).status_code == 403
    assert client.post(url + "/start", headers=headers(owner)).status_code == 409
    lobby = client.post(
        "/api/v1/leagues",
        headers=headers(owner),
        json={"name": "Not full", "pool_id": state["pool_id"], "capacity": 4},
    ).json()
    assert (
        client.post(
            f"/api/v1/leagues/{lobby['id']}/start", headers=headers(owner)
        ).json()["error"]["code"]
        == "league_not_full"
    )
    assert (
        client.post(
            "/api/v1/leagues/join",
            headers=headers(owner),
            json={"invite_code": "does-not-exist"},
        ).status_code
        == 404
    )
