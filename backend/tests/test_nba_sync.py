from uuid import UUID

import pytest
from conftest import headers
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from test_catalog import make_pool
from test_nba_provider import career, metadata

from app.db.catalog import (
    ExternalPlayerID,
    ImportRun,
    Player,
    PlayerPosition,
    SeasonStats,
)
from app.jobs.nba_sync import sync_nba
from app.providers.nba import NBADataError


class SyntheticClient:
    def active_players(self):
        return [metadata()]

    def player(self, nba_id):
        return metadata(nba_id)

    def career(self, player):
        return career(player)


def test_sync_is_idempotent_and_preserves_admin_configuration(db_app):
    app, client = db_app
    first = sync_nba(app.state.engine, "admin", SyntheticClient(), active=True)
    assert first["status"] == "complete" and first["synced"] == 1
    with Session(app.state.engine) as session:
        mapping = session.scalar(select(ExternalPlayerID))
        player = session.get(Player, mapping.player_id)
        player_id = player.id
        assert player.archived and player.tier == 5
        assert session.scalar(select(func.count()).select_from(PlayerPosition)) == 0
        player.tier, player.priority, player.archived = 2, 9, False
        session.add_all(
            [PlayerPosition(player_id=player.id, position=p) for p in ("PG", "PF")]
        )
        session.commit()
    pool_id = make_pool(client, [str(player_id)])
    frozen_before = client.get(f"/api/v1/pools/{pool_id}", headers=headers()).json()
    second = sync_nba(app.state.engine, "admin", SyntheticClient(), player_ids=[100])
    assert second["status"] == "complete"
    with Session(app.state.engine) as session:
        assert session.scalar(select(func.count()).select_from(Player)) == 1
        assert (
            session.scalar(select(func.count()).select_from(SeasonStats))
            == first["row_count"]
        )
        player = session.get(Player, player_id)
        assert (player.tier, player.priority, player.archived) == (2, 9, False)
        assert set(session.scalars(select(PlayerPosition.position))) == {"PG", "PF"}
        assert session.get(ImportRun, UUID(second["id"])).status == "complete"
    assert (
        client.get(f"/api/v1/pools/{pool_id}", headers=headers()).json()
        == frozen_before
    )
    history = client.get(
        f"/api/v1/players/{player_id}/history", headers=headers()
    ).json()
    assert history["coverage"]["complete"]
    summary = next(
        r
        for r in history["seasons"]
        if r["season"] == metadata().rookie_season + 1
        and r["phase"] == "regular"
        and r["scope"] == "TOTAL"
    )
    assert summary["totals"]["points"] == 300 and summary["averages"]["points"] == 15


def test_failed_player_transaction_writes_no_partial_catalog_or_stats(
    db_app, monkeypatch
):
    app, _ = db_app
    from app.jobs import nba_sync

    original = nba_sync.upsert_stat_rows

    def interrupted(session, rows, run_id):
        original(session, rows, run_id)
        raise NBADataError("Synthetic failure after writing rows")

    monkeypatch.setattr(nba_sync, "upsert_stat_rows", interrupted)
    result = sync_nba(app.state.engine, "admin", SyntheticClient(), player_ids=[100])
    assert result["status"] == "failed"
    with Session(app.state.engine) as session:
        assert session.scalar(select(func.count()).select_from(Player)) == 0
        assert session.scalar(select(func.count()).select_from(SeasonStats)) == 0
        assert session.scalar(select(func.count()).select_from(ExternalPlayerID)) == 0
        run = session.get(ImportRun, UUID(result["id"]))
        assert run.row_count == 0 and run.errors


def test_partial_batches_keep_successes_and_stop_repeated_failures(db_app):
    app, _ = db_app

    class UnavailableClient(SyntheticClient):
        attempted = []

        def career(self, player):
            self.attempted.append(player.nba_id)
            if player.nba_id != 100:
                raise NBADataError("Synthetic upstream timeout")
            return super().career(player)

    provider = UnavailableClient()
    result = sync_nba(
        app.state.engine, "admin", provider, player_ids=[100, 101, 102, 103, 104]
    )
    assert result["status"] == "partial" and result["synced"] == 1
    assert provider.attempted == [100, 101, 102, 103]
    with Session(app.state.engine) as session:
        assert session.scalar(select(func.count()).select_from(Player)) == 1
        assert (
            session.get(ImportRun, UUID(result["id"])).row_count == result["row_count"]
        )


def test_sync_requires_admin_and_does_not_guess_name_matches(db_app):
    app, client = db_app
    with pytest.raises(NBADataError, match="administrator"):
        sync_nba(app.state.engine, "not-an-admin", SyntheticClient(), active=True)
    from test_catalog import make_player

    existing = make_player(client, name=metadata().name)
    result = sync_nba(app.state.engine, "admin", SyntheticClient(), player_ids=[100])
    assert result["status"] == "failed"
    assert "external_ids.nba" in result["errors"][0]["message"]
    with Session(app.state.engine) as session:
        assert session.scalar(select(func.count()).select_from(Player)) == 1
        assert session.get(Player, UUID(existing["id"])).name == metadata().name


def test_concurrent_jobs_share_team_and_player_identities(db_app):
    from concurrent.futures import ThreadPoolExecutor

    from app.db.catalog import NBATeam

    app, _ = db_app

    def run(nba_id):
        return sync_nba(
            app.state.engine, "admin", SyntheticClient(), player_ids=[nba_id]
        )

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(run, [100, 101]))
    assert all(result["status"] == "complete" for result in results)
    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(run, [100, 100]))
    assert all(result["status"] == "complete" for result in results)
    with Session(app.state.engine) as session:
        assert session.scalar(select(func.count()).select_from(Player)) == 2
        assert session.scalar(select(func.count()).select_from(ExternalPlayerID)) == 2
        assert session.scalar(select(func.count()).select_from(NBATeam)) == 2


def test_upstream_failure_preserves_previously_imported_history(db_app):
    app, _ = db_app
    first = sync_nba(app.state.engine, "admin", SyntheticClient(), player_ids=[100])

    class UnavailableClient(SyntheticClient):
        def career(self, player):
            raise NBADataError("Synthetic upstream unavailable")

    failed = sync_nba(app.state.engine, "admin", UnavailableClient(), player_ids=[100])
    assert failed["status"] == "failed"
    with Session(app.state.engine) as session:
        assert (
            session.scalar(select(func.count()).select_from(SeasonStats))
            == first["row_count"]
        )
        assert set(session.scalars(select(SeasonStats.import_run_id))) == {
            UUID(first["id"])
        }
