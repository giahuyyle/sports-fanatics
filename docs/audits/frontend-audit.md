# Sports Fanatics frontend audit

This is the pre-repair audit. See [the completed remediation checklist](frontend-remediation.md) for current status.

Audit date: 25 October 2026. No application files or real admin data were changed.

## Scope and verification

- Reviewed all frontend page modules, router, shared components, local state objects and transitions, API clients, styles, current tests, and the backend integration contract.
- Browser coverage: landing, Home, NBA index, create, join, lobby, live draft, recap, settings, admin, unknown routes, and the intentionally disabled FPL redirect.
- Responsive matrix: 320, 375, 768, 1024, 1110, 1200, 1280, 1440, and 1920px. Default fixtures fit; valid long names expose additional failures.
- Admin checks used an isolated Firebase/API mock and a 300-player fixture. All requests were intercepted; no real admin mutations were made. Production authentication/authorization was not audited.
- Baseline: frontend lint, production build, and all 10 unit tests passed. Existing browser suite: 14 passed, 2 connected-emulator tests skipped. Additional targeted checks found cases missing from that suite.
- Axe scans supplemented manual keyboard and browser checks. The Firebase emulator warning landmark is test infrastructure and is excluded from product findings.
- Audit servers on ports 5188/5189 were stopped and verified closed. User-started servers were left untouched. Git source working tree remained clean.

## Findings

P1: prevent wrong writes or loss of saved state. P2: functional, workflow, layout, or accessibility defects. P3: lower-impact presentation issues. Workflow gaps are identified as such rather than represented as runtime exceptions.

### A01 · P1 · Pool switching can associate one pool with another pool’s players

Source: [frontend/src/pages/Admin.tsx:545](../../frontend/src/pages/Admin.tsx:545)

**Evidence / reproduction:** Browser reproduced: delay Pool A’s response, then select Pool B. When A finishes last, the dropdown remains B while Alice from A is checked and Bob from B is not. Save is enabled, so the next write can overwrite B with A’s selection.

**Proposed correction:** Make pool ID, loaded selection, and revision one coherent state. Cancel/ignore outdated responses and disable writes until the selected pool finishes loading.

### A02 · P1 · A failed pool load leaves stale players and enables publication

Source: [frontend/src/pages/Admin.tsx:548](../../frontend/src/pages/Admin.tsx:548)

**Evidence / reproduction:** Browser reproduced: load A, then return 503 for B. B remains selected, A’s selection remains visible, and Validate and publish pool is enabled. The user is invited to publish a pool whose actual contents were never loaded.

**Proposed correction:** Clear or retain the previous pool atomically on failure; keep Save/Publish disabled until the displayed pool has loaded successfully.

### A03 · P1 · Changes made during pool saving are incorrectly marked saved

Source: [frontend/src/pages/Admin.tsx:579](../../frontend/src/pages/Admin.tsx:579)

**Evidence / reproduction:** Browser reproduced: Save A with Alice selected, delay the PUT, then check Bob while it is pending. The request contains only Alice, but the UI ends with Alice and Bob checked and Publish enabled. Completion unconditionally clears poolDirty, even though the current selection differs from the request.

**Proposed correction:** Freeze editing while a write is pending or compare a captured selection revision with the current revision before clearing dirty state. Publish only the saved revision.

### A04 · P1 · A stale browser tab can overwrite newer saved state

Source: [frontend/src/state/store.ts:90](../../frontend/src/state/store.ts:90)

**Evidence / reproduction:** Browser reproduced with two tabs: change the profile to “Changed in second tab” in B, then queue a player in A. The persisted profile reverts to Sam Taylor. Each tab has an independent in-memory snapshot and every mutation rewrites the whole object; no storage-event synchronization exists. Draft ticks also write this object.

**Proposed correction:** Synchronize tabs and resolve revision conflicts, or move gameplay state to the backend. Avoid rewriting unrelated profile/league data during clock updates.

### A05 · P2 · Admin player catalog stops at 200 with no pagination

Source: [frontend/src/pages/Admin.tsx:92](../../frontend/src/pages/Admin.tsx:92)

**Evidence / reproduction:** Browser reproduced with a 300-player fixture: exactly 200 rows render and there are no next/previous/load-more controls. Search and refresh also hard-code limit=200. The backend already accepts offset and limit. Players after the first 200 cannot be browsed without a narrower search.

**Proposed correction:** Add server-backed pagination, page-size selection, loading/empty states, and stable selection across pages and searches.

### A06 · P2 · Archived players already in a draft pool cannot be deselected

Source: [frontend/src/pages/Admin.tsx:478](../../frontend/src/pages/Admin.tsx:478)

**Evidence / reproduction:** Browser reproduced: load a draft pool containing an archived player. Its checkbox is checked and disabled. The backend rejects archived players when saving/publishing a draft pool, but the UI gives no way to remove this one from the selection.

**Proposed correction:** Allow deselection of selected archived players, while preventing new selection. Provide a selected-player review list with removal controls.

### A07 · P2 · Changing pools silently discards unsaved selection changes

Source: [frontend/src/pages/Admin.tsx:547](../../frontend/src/pages/Admin.tsx:547)

**Evidence / reproduction:** Browser reproduced: load A, add Bob, switch to B, then return to A. Bob is gone, with no warning or preserved draft. Route changes also unmount the editor without guarding unsaved changes.

**Proposed correction:** Track pool-specific drafts, or prompt to save/discard before switching pools or leaving a dirty admin workspace.

### A08 · P2 · Editing another player during a pending save loses the new editor state

Source: [frontend/src/pages/Admin.tsx:141](../../frontend/src/pages/Admin.tsx:141)

**Evidence / reproduction:** Browser reproduced: save Alice with a delayed PUT, then click Edit Bob before it finishes. Bob appears in the editor, then the earlier save clears it and resets the heading to Add player. Edit and Cancel are not disabled by busy.

**Proposed correction:** Scope save completion to the submitted editor version, or disable conflicting editor actions until the operation completes.

### A09 · P2 · One failed admin read hides otherwise available data

Source: [frontend/src/pages/Admin.tsx:91](../../frontend/src/pages/Admin.tsx:91)

**Evidence / reproduction:** Browser reproduced: players, pools, and imports succeed, but audit history returns 503. Promise.all rejects before any setState call, so the catalog shows zero rows and “No players found. Add a player above.” even though the catalog request succeeded.

**Proposed correction:** Load panels independently, preserve successful/stale data, distinguish loading from empty and error, and offer per-panel retry.

### A10 · P2 · Permission loading is presented as access denial

Source: [frontend/src/pages/Admin.tsx:73](../../frontend/src/pages/Admin.tsx:73)

**Evidence / reproduction:** Browser reproduced by delaying GET /me for an authorized user: “Administrator access required” is visible before the permission result arrives. A /me network error also leaves allowed=false and displays the same denial state.

**Proposed correction:** Represent checking, allowed, denied, and request-failed as distinct states, with appropriate recovery actions.

### A11 · P2 · Non-JSON API failures expose a parser error instead of a useful message

Source: [frontend/src/lib/admin-api.ts:14](../../frontend/src/lib/admin-api.ts:14)

**Evidence / reproduction:** Browser reproduced with a 502 HTML gateway response: the user sees “Unexpected token < … is not valid JSON.” The client parses JSON before checking status or content type, and discards structured status/code information.

**Proposed correction:** Parse responses defensively and preserve HTTP status and domain error codes. Show actionable authentication, validation, conflict, and unavailable-service messages.

### A12 · P2 · A successful mutation can be presented as a failed operation

Source: [frontend/src/pages/Admin.tsx:160](../../frontend/src/pages/Admin.tsx:160)

**Evidence / reproduction:** Browser reproduced: PUT player succeeds, then audit refresh fails. The editor is already reset, no “Player saved” message appears, and the UI reports only “Audit service unavailable.” The same mutation-plus-refresh pattern is reused for pools and imports.

**Proposed correction:** Separate mutation outcome from refresh outcome: confirm committed writes, retain current data, and offer a retry for the failed refresh without repeating the mutation.

### A13 · P2 · Player editor cannot assign NBA teams or provider IDs

Source: [frontend/src/pages/Admin.tsx:28](../../frontend/src/pages/Admin.tsx:28)

**Evidence / reproduction:** Source and browser confirmed: nba_team_id and external_ids exist in the editable API model, but no controls render. New players always submit null and an empty mapping. The editor can preserve existing values, but cannot create or correct them.

**Proposed correction:** Add an NBA-team selector and provider-ID controls with validation. Keep all supported editable fields inspectable.

### A14 · P2 · Career imports lack a complete UI preparation and inspection workflow

Source: [frontend/src/pages/Admin.tsx:371](../../frontend/src/pages/Admin.tsx:371)

**Evidence / reproduction:** Source confirmed workflow gap: imports require player UUIDs and structured season totals, but the catalog/editor does not expose a copyable player ID, a schema/example download, or a career-history viewer. Backend history endpoints and import examples exist, but are not accessible from this screen.

**Proposed correction:** Expose IDs, link/download the import template, explain expected columns and season conventions, and show the stored history behind missing-season coverage.

### A15 · P2 · Published pools still look editable in the catalog

Source: [frontend/src/pages/Admin.tsx:475](../../frontend/src/pages/Admin.tsx:475)

**Evidence / reproduction:** Browser reproduced: select a published pool, then check a different player. The checkbox changes and selection count changes, while Save/Publish remain disabled. The screen therefore shows an apparent edited published selection that can never be saved.

**Proposed correction:** Make published selections explicitly read-only and provide a clear new-version/clone workflow for changes.

### A16 · P2 · Joining an already-owned local league duplicates the user and removes creator access

Source: [frontend/src/state/store.ts:128](../../frontend/src/state/store.ts:128)

**Evidence / reproduction:** Browser reproduced by joining OFFICE with a new team name. The original creator is changed from “you” to “host-office” and marked as a guest; another Sam Taylor joins as “you.” The local user can no longer start their own league. Rejoining can introduce further duplicate identities.

**Proposed correction:** Treat membership as idempotent: return to the existing membership instead of rewriting identity or ownership. Keep guest simulation separate from the current user.

### A17 · P2 · Invalid hidden FPL data resets otherwise valid NBA leagues

Source: [frontend/src/state/store.ts:19](../../frontend/src/state/store.ts:19)

**Evidence / reproduction:** Browser reproduced with a valid saved NBA league and an invalid old FPL squad. Although FPL_ENABLED is false, validation rejects the entire AppState and the UI replaces the saved league with sample leagues. The fallback can later overwrite the saved object on the next mutation.

**Proposed correction:** Validate/migrate feature slices independently. Recover or reset the damaged FPL slice without discarding valid NBA leagues or profile data.

### A18 · P2 · Settings claims persistence succeeded when storage is unavailable

Source: [frontend/src/pages/Settings.tsx:32](../../frontend/src/pages/Settings.tsx:32)

**Evidence / reproduction:** Browser reproduced with blocked localStorage: the banner says changes last only for this visit, while Save preferences says “Profile saved in this browser.” Persistence failures are swallowed by update(), which returns no outcome to callers.

**Proposed correction:** Return persistence status from the store and distinguish “saved locally” from “updated for this visit.” Apply the same distinction to other persisted actions.

### A19 · P2 · Recap card names push metadata and badges out of alignment

Source: [frontend/src/pages/Draft.tsx:716](../../frontend/src/pages/Draft.tsx:716)

**Evidence / reproduction:** Browser reproduced at 1920px: Giannis’s name occupies 78.375px versus 39.1875px for neighboring names. His team/position row is consequently 39.1875px lower. Cards have no reserved name region or aligned metadata/footer rows. This matches the supplied screenshot.

**Proposed correction:** Use a shared card layout with stable media, two-line name space, and aligned metadata/status regions; preserve full-name access rather than clipping names.

### A20 · P2 · Initials fallbacks collapse the portrait region in recap cards

Source: [frontend/src/components/ui.tsx:63](../../frontend/src/components/ui.tsx:63)

**Evidence / reproduction:** Browser reproduced in a completed six-manager draft: ordinary portraits are about 116.9px high in recap cards, but Victor Wembanyama’s initials fallback is only 44px high. His name starts roughly 72.9px above neighboring names.

**Proposed correction:** Reserve the same media frame and aspect ratio for images, loading/error states, and initials fallbacks.

### A21 · P3 · League card actions do not align when titles wrap

Source: [frontend/src/pages/Leagues.tsx:87](../../frontend/src/pages/Leagues.tsx:87)

**Evidence / reproduction:** Browser reproduced at 1110px with a valid multi-line league title: first card action starts about 330px from its card top, while Office Hoops starts about 285px down. Equal outer card height does not align the buttons.

**Proposed correction:** Use consistent card regions and push the action row to the bottom, with sensible reserved title space.

### A22 · P2 · Valid long user-entered names break responsive layouts

Source: [frontend/src/components/Shell.tsx:64](../../frontend/src/components/Shell.tsx:64)

**Evidence / reproduction:** Browser reproduced with names within existing 40-character profile/league and 30-character team limits. At 375px, Home overflowed by 542px and Lobby by 236px. At 1440px, a long profile name also pushed the header past the viewport. Default short fixtures pass all width checks.

**Proposed correction:** Audit min-width, wrapping, truncation with full-text access, and flex/grid shrink behavior across profile, league, participant, team, queue, and turn labels. Add long-string fixtures.

### A23 · P3 · Portrait jerseys and team labels can describe different contexts

Source: [frontend/src/state/players.json:1](../../frontend/src/state/players.json:1)

**Evidence / reproduction:** The supplied screenshot shows a Clippers jersey alongside CLE for Donovan Mitchell. Local image credits use the NBA latest-headshot URL, while the catalog retains sample affiliations/statistics; the recap does not display the same season-context disclaimer as the draft table. This is a data-presentation inconsistency, not a claim about current real affiliations.

**Proposed correction:** Use one defined data snapshot or clearly label portrait/current identity versus historical sample affiliation. Keep the context consistent on cards, details, and recaps.

### A24 · P2 · Browser Back can return to the root URL while leaving Home displayed

Source: [frontend/src/state/router.ts:3](../../frontend/src/state/router.ts:3)

**Evidence / reproduction:** Browser reproduced: load the application with no hash, click Open app, then press Back. The URL returns to the initial empty hash, but h1 remains “Your home court.” readPath substitutes the last navigated fallbackPath for the legitimate empty hash.

**Proposed correction:** Resolve an empty hash to the landing route; reserve sandbox navigation fallback for actual URL-write failure rather than normal history navigation.

### A25 · P2 · Landing demo actions break after local leagues are cleared

Source: [frontend/src/pages/Landing.tsx:123](../../frontend/src/pages/Landing.tsx:123)

**Evidence / reproduction:** Browser reproduced: clear leagues, open the landing, then Explore the draft. It still targets the fixed sunday ID and ends at the unavailable-page screen. The ticket and draft-preview entry use the same fixed link.

**Proposed correction:** Launch an explicitly separate sample draft or restore/initialize a demo on request. Avoid links whose targets can be deleted by ordinary settings actions.

### A26 · P2 · Admin and recovery routes have incomplete titles and heading focus

Source: [frontend/src/App.tsx:38](../../frontend/src/App.tsx:38)

**Evidence / reproduction:** Browser confirmed admin title is “Your home court · Sports Fanatics.” Unknown routes also use that title, and their EmptyState renders only h2, which axe flags for missing h1. Heading focus runs once per path and does not wait for lazy Admin content to resolve.

**Proposed correction:** Use explicit route metadata, a page-level recovery heading, and a focus handoff after lazy content becomes available.

### A27 · P2 · Clicks on dialog padding unexpectedly close the dialog

Source: [frontend/src/components/ui.tsx:131](../../frontend/src/components/ui.tsx:131)

**Evidence / reproduction:** Browser reproduced by opening Add a local guest team and clicking five pixels inside the dialog’s side padding. Because the click target is the dialog itself, the handler closes it as if the backdrop had been clicked.

**Proposed correction:** Distinguish actual backdrop coordinates from clicks inside the dialog bounds. Keep close-button and Escape behavior explicit.

### A28 · P2 · Mobile navigation does not contain keyboard focus or close on Escape

Source: [frontend/src/components/Shell.tsx:39](../../frontend/src/components/Shell.tsx:39)

**Evidence / reproduction:** Browser reproduced at 375px: Escape leaves the full-screen menu open; Tab after its profile button moves focus into the obscured page. The overlay neither traps focus nor makes the page behind it inert.

**Proposed correction:** Use an accessible modal/drawer interaction with Escape, focus containment, background inertness, and focus restoration to the menu trigger.

### A29 · P2 · Selecting a player on mobile leaves the draft action offscreen

Source: [frontend/src/pages/Draft.tsx:388](../../frontend/src/pages/Draft.tsx:388)

**Evidence / reproduction:** Browser reproduced at 375px: click Stephen Curry in the player list. His detail panel updates above the list, but the “Draft Stephen” action ends around 108px above the viewport, so no drafting action is visible where selection occurred.

**Proposed correction:** Use a details sheet, a visible sticky action, or deliberate focus/scroll handoff so selection and its primary action remain connected.

### A30 · P2 · Draft detail stays on an unavailable player and misstates ownership

Source: [frontend/src/pages/Draft.tsx:44](../../frontend/src/pages/Draft.tsx:44)

**Evidence / reproduction:** Browser reproduced: draft Shai at the first Sunday League turn. The next snake pick is also yours, but the detail panel remains on Shai with “Already drafted” and “This player belongs to another roster in this league,” even though he is on your own roster. Re-entering the draft always selects Shai again.

**Proposed correction:** Choose an appropriate available player when the current selection is no longer actionable, and derive ownership text from the actual pick owner.

### A31 · P2 · Player search fails ordinary unaccented spelling

Source: [frontend/src/pages/Draft.tsx:87](../../frontend/src/pages/Draft.tsx:87)

**Evidence / reproduction:** Confirmed by running the exact search predicate on the current player data: Jokic, Doncic, and Sengun each return no matches despite Jokić, Dončić, and Şengün being present. Only lowercase normalization is applied.

**Proposed correction:** Normalize diacritics consistently for search while preserving the proper display names. Add alternate-spelling search tests.

### A32 · P2 · Visible stat sort labels do not match their accessible names

Source: [frontend/src/pages/Draft.tsx:366](../../frontend/src/pages/Draft.tsx:366)

**Evidence / reproduction:** Axe confirmed label-content-name-mismatch on PTS/REB/AST buttons: the visible strings are replaced by accessible names “Sort by points/rebounds/assists” that omit those labels. This makes voice activation by the visible label unreliable.

**Proposed correction:** Include the displayed abbreviation in the accessible name, e.g. “PTS: sort by points.”

### A33 · P2 · Repeated complementary landmarks have no distinguishing labels

Source: [frontend/src/components/Shell.tsx:39](../../frontend/src/components/Shell.tsx:39)

**Evidence / reproduction:** Axe confirmed landmark-unique on create, join, lobby, and draft pages. The global sidebar and the page-specific aside both expose unnamed complementary landmarks.

**Proposed correction:** Use appropriate nav containers for global navigation and meaningful accessible labels for supplementary page regions.

### A34 · P2 · Draft tabs and player statistics lack complete semantic relationships

Source: [frontend/src/pages/Draft.tsx:185](../../frontend/src/pages/Draft.tsx:185)

**Evidence / reproduction:** Source confirmed: mobile buttons expose role=tab but have no aria-controls/tabpanel relationships. The statistical “table” is nested divs without table/grid semantics, so column labels are not programmatically associated with each player’s values. Keyboard arrow movement exists, but does not supply those relationships.

**Proposed correction:** Complete the tab/panel pattern and use a real accessible table or equivalent correctly structured markup for player statistics.

### A35 · P3 · Some miniature landing labels are too small and have insufficient contrast

Source: [frontend/src/styles/reference.css:1](../../frontend/src/styles/reference.css:1)

**Evidence / reproduction:** Axe found the YOU ticket avatar at 6px with contrast 4.34:1 in the tested desktop state, below 4.5:1 for normal text. Several miniature preview labels also use the reference’s tiny typography.

**Proposed correction:** Raise meaningful label sizes and contrast; if an avatar is purely decorative, remove redundant text from the accessibility tree while retaining an accessible explanation elsewhere.

## Integration gaps, separate from defects in the current local demo

The repository explicitly documents that only administration is connected to the backend. These are planned integration gaps rather than newly discovered failures of an already connected game:

1. Gameplay still reads and writes the browser-local store. Creating a player or publishing a pool in admin does not update the draft’s static `players.json` catalog. User sign-in exists only in the admin experience.
2. Frontend league settings offer 3/4/5 flexible players. The current backend contract uses 10 players, two from each tier, and starter/bench position assignments. The frontend does not expose pool selection, tiers, legal-pick feasibility, lineup editing, or the paused state.
3. Frontend types use numeric player IDs, a single position string, a `remaining` counter, and local participant IDs. The backend uses player and pool-player UUIDs, multiple eligible positions, server deadlines/revisions, and authenticated SSE event replay. These need explicit API models/adapters; connecting only the existing buttons would not be sufficient.

See [backend integration contract](../../docs/backend/INTEGRATION.md). FPL is intentionally disabled; its visibility is not a bug, and the audit does not recommend enabling it as part of repairs.

## Recommended repair sequence

1. Fix A01–A04 first and add regression tests for response ordering, failure during pool selection, edits during saves, and cross-tab writes.
2. Repair admin catalog/pool workflows: pagination, archived removal, immutable published views, unsaved-change protection, independent loading, and reliable mutation feedback.
3. Consolidate card layout and long-text handling, addressing recap names, media fallback sizing, league action alignment, and valid long user strings.
4. Repair routing, demo links, dialog/mobile interactions, search, and accessibility semantics.
5. Integrate real gameplay using the current backend contract in a separately scoped change. Preserve the intentional NBA-only feature flag.

## Evidence artifacts

- [Primary browser results](/private/tmp/sports-fanatics-audit/results.json)
- [Layout and accessibility results](/private/tmp/sports-fanatics-audit-extra/results.json)
- [Error and persistence results](/private/tmp/sports-fanatics-audit-final/results.json)
- [Admin accessibility results](/private/tmp/sports-fanatics-audit-admin-a11y/results.json)
- [Recap screenshot](/private/tmp/sports-fanatics-audit/recap.png)
- [Fallback image layout screenshot](/private/tmp/sports-fanatics-audit-extra/fallback-recap.png)
- Temporary audit harnesses were kept outside the repository; no implementation or dependency changes were made to the app.
