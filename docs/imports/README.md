# Career statistics imports

The primary automated source is [nba_api](NBA-API.md). Use its operator sync job
for NBA identities and full career season totals; CSV/JSON imports remain available
for verified corrections and coverage gaps.

Imports contain **season totals**, not averages. Required totals are games,
starts, minutes, points, rebounds, assists, steals, blocks, turnovers, fouls,
fg_made, fg_attempted, three_made, three_attempted, ft_made, ft_attempted.
Counts are nonnegative; minutes may be fractional. Starts cannot exceed games;
made shots cannot exceed attempts; threes cannot exceed field goals. All totals
must be zero in an explicit zero-game season. Missing fields are errors, not zeros.

Upload with `POST /api/v1/admin/imports`:
`{source: "source description", format: "json" | "csv", data: "file contents"}`.
Maximum: 5 MB text, 10,000 rows per batch. The dashboard reads the chosen file.

- `player_id`: internal NBA player UUID returned by the catalog, not provider ID.
- `season`: starting year, e.g. 2025 means 2025/26.
- `phase`: `regular` or `playoffs`.
- `scope`: `TOTAL` for the entire season, or an NBA team code registered through
  `/admin/nba-teams` for a team split. TOTAL must not be a team's code.
- `totals`: required numeric fields in JSON; flat columns in CSV.

The example files contain synthetic statistics and placeholder UUIDs. Replace
UUIDs with catalog IDs before importing. Import totals and splits as separate rows;
never add TOTAL to the team splits. Include TOTAL regular-season rows for every
career season, including seasons without appearances. Current-season rookies can
instead have explicit `no_appearances=true` metadata until they play.

All rows validate before any statistic changes. Rejected files record errors but
write no statistics. A repeat import upserts by (player, season, phase, scope);
source/import provenance changes to the successful import. Tier and position
settings are not touched. Unexpected/duplicate columns or duplicate row identities
are invalid; correcting a failed batch creates a new import report.

`GET /api/v1/admin/imports` shows recent reports; `/admin/audit` shows admin actions.
Raw imported files are not retained; retain original licensed files separately.
The nba_api provider integration is available now; individual game logs remain
future work.
