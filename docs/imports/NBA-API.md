# NBA data through nba_api

The backend uses [swar/nba_api](https://github.com/swar/nba_api) to retrieve NBA
player identities, current affiliations, and career season totals directly from
NBA.com endpoints. No paid-provider API key is needed. Requests run as explicit
operator jobs, so upstream delays never block a pick or an API page request.

## Run with Compose

The new dependency requires rebuilding the backend image. From the repo root:

```sh
docker compose build migrate
docker compose run --rm --no-deps api python -m app.cli nba-sync \
  --admin-uid YOUR_FIREBASE_UID --player-id 2544
```

Use an existing platform administrator's Firebase UID, after signing in and
running `grant-admin` as described in the [Firebase guide](../backend/FIREBASE.md).
The command records that administrator as the import/audit actor. The first
command above imports LeBron James' NBA identity and complete returned career.

Import current-season rostered NBA players, including all their past seasons:

```sh
docker compose run --rm --no-deps api python -m app.cli nba-sync \
  --admin-uid YOUR_FIREBASE_UID --active
```

For a smaller batch or a resumed run:

```sh
docker compose run --rm --no-deps api python -m app.cli nba-sync \
  --admin-uid YOUR_FIREBASE_UID --active --offset 0 --limit 25
```

Active players are sorted by NBA ID before slicing. `--offset` is a position in
that returned list, not a durable cursor: rosters can change between runs. Re-syncs
are idempotent, so retrying an overlapping batch is safe. For a fixed selection,
repeat `--player-id`, including for retired players. NBA IDs can be looked up
through `nba_api.stats.static.players`, whose reference list ships with the package;
active discovery itself uses a fresh endpoint response rather than that cache.

For native development, replace the Compose prefix with
`cd backend` then `uv run python -m app.cli nba-sync ...` after `uv sync`.

## What is imported

- `CommonAllPlayers`: current-season rostered player IDs, names, rookie seasons,
  and current teams. `CommonPlayerInfo` supplies metadata for explicit player IDs.
- `PlayerCareerStats` with `PerMode=Totals`, NBA league ID `00`: regular-season
  and playoff season totals, including team splits and provider aggregate rows.
- Provider identities use `external_ids: {"nba": "2544"}`. Matching is by NBA ID;
  the job never silently merges players based on names.
- Single-team seasons receive a separate TOTAL row copied from the source team
  totals. `TEAM_ID=0` aggregate rows (including TOT/2TM/3TM codes) map to TOTAL.
  Multi-team seasons require an upstream aggregate; splits are never added on top
  of that aggregate. Existing API averages/percentages remain derived from totals.
- Team codes are preserved historically. Unknown historical codes get an explicit
  code-based label rather than an incorrect current franchise name.

Each player commits in one transaction. Validation failures roll back new
identities and statistics together. Network failures preserve previous history.
When valid metadata is available but a new player's career request fails, its
archived identity is kept with incomplete coverage and a pending-history report;
no zero-appearance exemption is inferred from a failed request.
The job upserts returned season/phase/team rows and does not delete omitted rows.
Missing seasons remain visible as coverage gaps, including unavailable older
metrics; they are never automatically converted into zero-game seasons. Verified
zero-game seasons can still be supplied through the manual import format.
An empty returned career can still register an archived player identity, with
missing seasons reported as incomplete coverage. It is not proof of zero NBA
appearances. The no-appearances exemption is used only for current-season rookies
explicitly flagged without appearances. An empty response cannot replace stored
history for a player with recorded appearances.

## Admin review and existing records

**New players start archived, with no eligible positions.** Tier 5 and automatic
priority 1000000 are placeholders, not performance assessments. In the admin
dashboard, assign the intended tier, positions and priority, then unarchive the
player. Complete career coverage is also required before pool publication.

Subsequent syncs update source-owned names, rookie season, affiliation, appearance
status and statistics. They preserve your tiers, eligible positions, priority,
archive choice, other provider IDs, and all published pool snapshots. A retired
or missing roster entry is not automatically archived or deleted.

If a manually entered player has the same name but no NBA ID, the job reports a
linking error rather than inserting a duplicate. Use the admin update API to add
`external_ids.nba` to that existing player, preserving the other editable fields,
and retry the sync. Different players with the same name and distinct NBA IDs
remain distinct.

No schema migration is required: the integration uses the existing external-ID,
statistics, NBA-team, import-report and audit tables in schema revision `0005`.

## Errors and operational controls

Defaults: 20-second request timeout, two retries after the first attempt, and a
one-second minimum interval between NBA requests. Override with `--timeout`,
`--retries` (0–5) and `--delay`. Retry backoff is bounded. Three consecutive NBA request
failures stop the batch so an upstream outage does not trigger hundreds of retries.
Avoid running multiple jobs concurrently against the provider; database advisory
locks prevent duplicate player insertion but are not a shared network rate limiter.

The command prints JSON progress and a final report ID, status, synced-player
count and row count, plus selected/attempted/unattempted counts and the number
of incomplete histories. `catalogued` includes identities saved pending history;
`pending_histories` counts those whose career request failed. Reports appear under recent imports in the admin dashboard,
with source `nba_api:career` or `nba_api:active`; audit history records the actor.
`complete` exits 0; `partial`/`failed` exits 1. Successful players in a partial batch
remain committed and can be safely revisited. Invalid player records are reported and skipped without stopping later records.
A graceful interruption closes the
report; a force-killed process may leave a `running` report.

NBA endpoints may time out or reject traffic from some networks. Keep previously
synced data, inspect the import report, and retry a small batch from a network that
can reach stats.nba.com. No fabricated fallback statistics are generated. File
imports remain available for verified corrections. Syncing does not publish pools
or change draft eligibility automatically.

## Verification

On 25 October 2026, the backend regression suite passed 37 tests against disposable
PostgreSQL (the optional Auth-emulator test was skipped). Provider tests use
synthetic endpoint fixtures and cover retries, aggregates, missing data, repeated
syncs, concurrent identities, rollback, and preservation of manual configuration.
A separate live check imported 86 regular/playoff season-total and team-split rows
for NBA ID 2544 into an isolated verification database. The updated backend Docker
image also built successfully. These checks did not populate the application's
running database; run the operator command above to load its catalog.
