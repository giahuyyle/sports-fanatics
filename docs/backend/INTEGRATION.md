# Gameplay integration contract

Interactive OpenAPI documentation: `/docs`; machine-readable specification:
`/openapi.json`. All new application endpoints are under `/api/v1`.

## Identity and ownership

Send `Authorization: Bearer FIREBASE_ID_TOKEN` on every request, including event
streams. Firebase handles Google/email sign-in and token refresh. Never put tokens
in URLs. Call `GET /me` to obtain the internal user ID, admin status and team.
Create a team with `POST /me/team {name}`; rename it using `PATCH /me/team`.
Names are globally unique after NFKC normalization, collapsed whitespace and
case folding. A user owns one team; each league has its own roster for that team.

Errors use `{error: {code, message, details?}}`. Show the message; handle codes
without parsing human text. `401` requires sign-in, `403` denies access, `409`
means a conflict, `422` means invalid input, and `503` means validation/database
availability issues. Firebase UID is never a league-entry or team identifier.

## Catalog and pools

- `GET /players?search=&position=PG&tier=1&offset=0&limit=50`
- `GET /players/{id}` and `/players/{id}/history`
- `GET /nba-teams`, `/pools`, `/pools/{id}`

Player IDs identify NBA players. **Pool-player IDs** identify frozen eligibility
within a version and are the IDs used for picks, queues and lineup requests.
History returns distinct TOTAL and team-split rows; display TOTAL as the season
summary rather than summing all returned rows. Percentages are fractions or null;
zero-game averages are null. Season integers name the starting calendar year.
Coverage requires regular-season TOTAL rows from rookie season through the
current season, including explicit zero-game rows for seasons without appearances.
Playoff rows are stored when supplied, but absence is not treated as a coverage
gap because not every player reaches the playoffs.

## League lifecycle

1. `POST /leagues {name, pool_id, capacity: 4, timer: 60}` selects a published pool.
2. Share the returned invite code; other users call `POST /leagues/join {invite_code}`.
3. `GET /leagues` lists the caller's leagues.
4. `GET /leagues/{id}` returns a consistent snapshot, entries, picks and lineups.
5. The owner calls `POST /leagues/{id}/start` after the league fills.

Status is lobby/live/paused/complete. There are always ten players per roster.
Each player has one assignment: PG/SG/SF/PF/C on starters or bench. Eligibility and
tiers are frozen at draft start. Position assignments can change as picks arrive.
The randomized order reverses each round; `draft.current_entry_id` identifies the
current manager. Server UTC `deadline` is authoritative.

## Picks, queues and lineups

`POST /leagues/{id}/picks`:

```json
{
  "pool_player_id": "UUID_FROM_THE_FROZEN_POOL",
  "expected_revision": 1,
  "idempotency_key": "A_UNIQUE_REQUEST_UUID"
}
```

Reuse the same key and body after a network failure. A successful retry returns
the original pick even after the turn advances. Reusing the key for another pick
fails. On `stale_revision`, refresh the snapshot before a new action. Never retry
an uncertain request with a new key. `roster_infeasible` means that pick would
prevent one or more squads finishing; `validation_unavailable` is retryable and
must not be displayed as an illegal player. An expired turn waits for the worker.

`GET /leagues/{id}/queue` returns the caller's private queue. Replace it atomically
using `PUT /leagues/{id}/queue {pool_player_ids: [...]}`. The worker tries legal
queued players, then priority ordering (lower numbers first, pool-entry UUID as
the tie-break), then a verified completion fallback.

After completion, use `PUT /leagues/{id}/lineup` with all ten slots:
`{slots: [{role: "starter", position: "PG", pool_player_id: "..."}, ...]}`.
Use each drafted player exactly once. The server rejects the entire update if any
slot is invalid. A lineup swap does not change drafted ownership or tier quotas.

## Event stream and reconnects

Fetch a snapshot first, then open `/leagues/{id}/events?after_revision=REVISION`
using authenticated **streaming fetch**, not native EventSource without headers.
Parse standard SSE framing; reads may split lines arbitrarily. Events contain
`revision`, `kind` and `payload`, and SSE `id` equals revision. Event kinds are
`draft.started`, `pick.committed`, `lineup.updated`, `draft.paused`, `draft.resumed`.
They invalidate the snapshot; fetching a new snapshot is the simplest initial
integration. Never apply an older revision over newer state.

Persist the last processed revision. Reconnect with that revision or a
`Last-Event-ID` header. Events remain in PostgreSQL, so reconnects work across API
processes. `follow=false` returns finite replay for diagnostics/tests. Streams
periodically reverify authentication; an `authentication_required` event means
refresh credentials and reconnect. On network failure use backoff; after an
invalid cursor or unexplained revision gap fetch a new snapshot.

Snapshots and streams require league membership. Pause reasons are visible in the
snapshot. Only a platform admin can call `/admin/leagues/{id}/resume`, which first
revalidates feasibility; league owners cannot bypass roster constraints.

## Admin catalog pagination

`GET /admin/players?search=&offset=0&limit=50` returns
`{items, total, offset, limit}` with all archive states included. Results are
ordered by name and player ID. The dashboard retains pool selections across
pages and searches. The existing public `/players` array contract is unchanged.

Archived players remain in the catalog and in historical drafts. They are excluded
from new draft pools; newly synced players are archived pending manual tier and
position review. Archiving is an administrative availability choice, not a claim
that the NBA player retired or that their career history is missing.

## Admin mutation contracts

Create/update players with `POST /admin/players` and `PUT /admin/players/{id}`.
Updates replace the editable player record, including positions and provider IDs;
preserve fields you do not intend to change. Archive rather than delete players.

Create NBA team identities with `POST /admin/nba-teams {code, name}`.
Create pools with `POST /admin/pools {name}`; replace their selections using
`PUT /admin/pools/{id}/players {player_ids: [...]}`. This captures current tier,
positions and priority. Publish with `POST /admin/pools/{id}/publish`.
Published pools cannot be changed; create a new version and select players again.
Publication verifies history/eligibility; league start separately verifies that
all managers can fill their squads. Existing drafts remain on their original pool.
