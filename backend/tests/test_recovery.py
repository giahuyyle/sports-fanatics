from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from uuid import UUID

from conftest import headers
from sqlalchemy.orm import Session
from test_drafts import next_request, setup_league

from app.db.draft import Draft
from app.jobs.worker import process_expired


def expire(app, league_id, corrupt=False):
    with Session(app.state.engine) as session:
        draft = session.get(Draft, UUID(league_id))
        draft.deadline = datetime.now(UTC) - timedelta(seconds=5)
        if corrupt:
            draft.completion = {}
        session.commit()


def test_timeout_race_fallback_and_replay(db_app):
    app, client = db_app
    state, managers = setup_league(client)
    url = f"/api/v1/leagues/{state['id']}"
    body = next_request(app, state)
    manager = managers[state["draft"]["current_entry_id"]]
    assert (
        client.put(
            url + "/queue",
            headers=headers(manager),
            json={"pool_player_ids": [body["pool_player_id"]]},
        ).status_code
        == 200
    )
    expire(app, state["id"])
    # Worker and late manual pick race for the same league lock.
    with ThreadPoolExecutor(max_workers=2) as executor:
        worker = executor.submit(process_expired, app.state.engine)
        manual = executor.submit(
            client.post, url + "/picks", headers=headers(manager), json=body
        )
        assert worker.result()
        assert manual.result().status_code == 409
    state = client.get(url, headers=headers("user0")).json()
    assert len(state["picks"]) == 1 and state["picks"][0]["automatic"]
    assert state["picks"][0]["pool_player_id"] == body["pool_player_id"]
    assert client.get(url + "/queue", headers=headers(manager)).json() == []
    # A new worker process sees the persisted deadline; repeated scans cannot repick.
    assert not process_expired(app.state.engine)
    expire(app, state["id"])
    assert process_expired(app.state.engine, timeout=0.000001)
    state = client.get(url, headers=headers("user0")).json()
    assert len(state["picks"]) == 2 and state["status"] == "live"
    first = client.get(url + "/events?follow=false", headers=headers("user0"))
    second = client.get(url + "/events?follow=false", headers=headers("user1"))
    assert first.text == second.text
    assert first.text.count("event: pick.committed") == 2
    replay = client.get(
        url + "/events?follow=false", headers={**headers("user1"), "Last-Event-ID": "2"}
    )
    assert "id: 3\n" in replay.text and "id: 2\n" not in replay.text
    assert (
        client.get(
            url + "/events?follow=false", headers=headers("outsider")
        ).status_code
        == 403
    )


def test_invalid_witness_pauses_and_admin_can_resume(db_app):
    app, client = db_app
    state, _ = setup_league(client)
    url = f"/api/v1/leagues/{state['id']}"
    expire(app, state["id"], corrupt=True)
    assert process_expired(app.state.engine, timeout=0.000001)
    paused = client.get(url, headers=headers("user0")).json()
    assert paused["status"] == "paused"
    assert paused["draft"]["deadline"] is None
    assert not process_expired(app.state.engine)
    assert (
        client.post(
            f"/api/v1/admin/leagues/{state['id']}/resume", headers=headers("user0")
        ).status_code
        == 403
    )
    response = client.post(
        f"/api/v1/admin/leagues/{state['id']}/resume", headers=headers()
    )
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "live"
