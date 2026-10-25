# Frontend remediation — 26 October 2026

All 35 findings in the [pre-repair audit](frontend-audit.md) are addressed. Existing pagination and the basic player-card regions were retained and verified; the rest was repaired in focused Conventional Commits. The simultaneous affiliation refresh was preserved.

The cards follow the user's sketch: fixed-ratio portrait, primary position on the left, full name in a stable central band, matching team logo on the right, and a pick footer. Backgrounds follow the displayed team. All 30 NBA team logos are available locally, with credits. The layout gives long surnames enough room rather than squeezing five narrow cards into a row.

## Item-by-item closure

| ID | Status | Resolution and evidence |
| --- | --- | --- |
| A01 | Fixed | Pool requests and conflicting operations are serialized; selection and pool identity change together only after a successful load. Browser regression checks disabled transitions and final identity. |
| A02 | Fixed | Failed pool loads retain the coherent previous pool and selection, with an error; the failed target cannot be saved or published. |
| A03 | Fixed | Selection controls and pool/editor operations are disabled while a save is pending. The saved selection cannot be changed underneath dirty-state completion. |
| A04 | Fixed | Cross-tab writes use Web Locks where supported, read current storage inside the lock, and synchronize storage events. The clock deduplicates ticks from multiple tabs. Tested with two browser pages. |
| A05 | Verified | Server-backed catalog pagination reaches all records and preserves selections across searches/pages. An intercepted 123-player catalog verifies next/previous behavior and selection retention. |
| A06 | Fixed | Archived players may be removed from existing selections but cannot be newly selected. Selected-player review also provides removal independently of the catalog page. |
| A07 | Fixed | Dirty pool switching and navigation require explicit discard. Reload/close uses the browser's unsaved-changes guard. A dismissed warning retains both route and selection. |
| A08 | Fixed | Player fields, Edit and Cancel operations are locked during requests, so completion cannot erase a newer editor. |
| A09 | Fixed | Catalog, pools, imports, history and teams load independently. Successful panels and older data are retained when another panel fails; retry is available. |
| A10 | Fixed | Permission checking, denied access and permission-service failure are separate states. A failed check offers retry instead of claiming access was denied. |
| A11 | Fixed | API failures retain status/code/details, show field-specific validation messages, and defensively parse responses. Cancellation signals are combined with request deadlines. HTML gateway failures and connection timeouts give actionable messages rather than JSON parser exceptions. |
| A12 | Fixed | Mutation success is reported independently of refresh failures. Read failures do not hide a successful write or cause automatic mutation retries. |
| A13 | Fixed | Player editor now includes an NBA-team selector and validated provider-ID JSON, preserving existing values during edits. |
| A14 | Fixed | Catalog exposes selectable player IDs; history is inspectable, including season/phase/TOTAL context and null averages. JSON import templates can include the selected player's ID. |
| A15 | Fixed | Published-pool selections are read-only. The UI explains how to carry the selection into a newly named pool version, then save and publish. Publication explicitly confirms its irreversible effect. |
| A16 | Fixed | Joining a browser-local league already owned by this profile returns to the existing membership. It never duplicates the user, changes the creator, or converts that user into a simulated guest. |
| A17 | Fixed | Saved slices recover independently. Invalid hidden FPL data no longer discards valid NBA leagues; recoverable data is retained and an original storage backup is saved where possible. |
| A18 | Fixed | Persistence reports its outcome. Settings distinguishes a saved browser profile from a visit-only update when storage is blocked. |
| A19 | Fixed | Names occupy a stable identity band alongside the primary position and team logo; metadata/footer alignment is independent of one- or two-line names. Geometry and screenshots cover completed drafts. |
| A20 | Fixed | Images and initials use the same reserved portrait frame. Six-manager recap coverage includes a fallback portrait without shifting card rows. |
| A21 | Fixed | League cards reserve name space and push their participant/action region to the bottom. |
| A22 | Fixed | Long names wrap within shrinkable layout regions, while profile labels truncate within bounded width. Browser checks use valid 40-character names at 320/375/768/1110/1440px. |
| A23 | Addressed | Preserved the verified affiliation refresh and separate team/statistics context labels. Historical sample statistics and portrait uniform differences are explicit rather than implied to be a single live snapshot. |
| A24 | Fixed | An empty hash resolves to the landing route. Browser Back from Home returns to the original hashless landing correctly. |
| A25 | Fixed | Landing draft actions initialize a missing sample league without replacing other leagues. They continue working after the user clears local leagues. |
| A26 | Fixed | Admin has its own title; unavailable pages render a page-level heading. Heading focus waits for lazy content instead of running only before it loads. |
| A27 | Fixed | Dialog dismissal checks actual backdrop coordinates. Clicking the dialog's interior padding keeps it open; Escape still dismisses it. |
| A28 | Fixed | Mobile navigation is a labeled dialog, traps focus, makes the underlying app inert, closes on Escape/desktop resize, and restores trigger focus. |
| A29 | Fixed | Selecting a player on mobile brings the draft action into view and focuses the scouting heading. |
| A30 | Fixed | Default selection follows an available player after a pick. Explicit inspection of an owned player says it is on the user's roster; other ownership text derives from the pick owner. |
| A31 | Fixed | Search normalizes diacritics and whitespace while preserving display spelling. Browser coverage searches for Sengun and finds Şengün. |
| A32 | Fixed | Stat-sort accessible names include PTS/REB/AST; current sort direction is exposed through column-header semantics. |
| A33 | Fixed | Global navigation no longer adds an unnamed complementary landmark; supplementary page regions have distinct labels. |
| A34 | Fixed | Draft tabs reference their named panels. Player statistics use native table/caption/header/row/cell markup instead of unrelated divs. |
| A35 | Fixed | Ticket initials have a readable minimum size and contrasting colors; miniature supporting labels were increased. The final route scan finds no contrast violation. |

## Validation

- ESLint, Prettier check, TypeScript/Vite production build: passed.
- Unit tests: 16 passed, including saved-state recovery and existing draft rules.
- Full browser suite: 34 passed; 3 live Firebase/PostgreSQL integration tests explicitly skipped because that environment was not started. Admin repair tests intercept authentication and API responses and never mutate real data.
- Additional focused card/interaction runs verified repaired cases, including a Giannis card preview.
- Axe checks: no violations on the 10 scanned desktop routes/states (landing, Home, NBA index, create, join, lobby, draft, settings, unavailable page, and missing-configuration admin). This is scoped automated coverage, not a claim about every possible accessibility state.
- Default responsive coverage and explicit long-string coverage passed. The full suite includes card media fallbacks, read/write failures, two-tab updates, mobile focus, deleted demo links, and pagination.
- Temporary test/accessibility servers were shut down; pre-existing user servers were not stopped.

Evidence is available locally under `/private/tmp/sports-fanatics-repairs/`, including `cards-desktop.png`, `cards-mobile.png`, `giannis-card.png`, and `accessibility.json`.

## Scope boundaries

These repairs do not turn the local gameplay demo into server-backed multiplayer. The backend's ten-player/tier/position rules, identity model, authoritative clock and SSE integration remain a separate milestone, as identified separately in the audit. FPL remains intentionally disabled. Team color values are recognizable interface adaptations, not official color-specification claims.

## Implementation commits

- `86b8788` — team-colored player cards and initial checklist.
- `9d57323` — admin concurrency, independent reads, metadata and history workflows.
- `e06d59a` — saved-state recovery, membership preservation and cross-tab writes.
- `b56da88` — routing, mobile interactions, semantic tables and accessibility.
- `2f04638` — complete local team-logo set.
- `6acc636` — admin asynchronous-error and workflow regression coverage.
- `9e0ef20` — field validation feedback and bounded cancellable requests.

The separate `3150053` affiliation refresh was preserved rather than overwritten.
