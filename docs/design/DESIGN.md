# Sports Fanatics — Design System & Product Reference

Version: 1.0 · Handoff date: 25 October 2026

## 1. Authority and scope

This document records the current Sports Fanatics direction, the reusable system behind it, and implementation guidance for extending it. Its companion files are:

- `sports-fanatics-v2.html` — the current working, self-contained prototype.
- `design-canvas.html` — a visual index of the screens, states, flows, and components.
- `MASTER-PROMPT.md` — the complete reusable product/build brief.

The canvas uses source-rendered reference views, not browser screenshots. Its views are documentation; open the linked working prototype for interactions. Prototype state is browser-local when storage is available. Multiplayer, invitations, and predictions are illustrative. Python/FastAPI services are not implemented.

The original `index.html` is an earlier draft-first prototype. It is not the current landing-first entry.

## 2. Product principles

**One brand, two jobs.** NBA is social drafting; FPL is analytical planning. Separate their workspaces while keeping typography, controls, navigation, and interaction language consistent.

**NBA first.** The landing narrative and primary create-league action lead into private NBA leagues. The draft room is the central product experience; FPL has its own green-accented workspace.

**Friendly competition.** Use direct, conversational language: “Your people. Your picks.”, “You’re on the clock”, and “Save your transfer.” Avoid dense analyst jargon and manufactured marketing evidence.

**Decisions over decoration.** Prioritize whose turn it is, the available choices, the cost of an action, and what happens next. Avoid invented scoring, live claims, or implied model accuracy.

## 3. Visual thesis

A charcoal sports editorial system with condensed display type, warm white text, thin structural borders, compact statistics, and generous decision space. Orange signals NBA actions; green signals FPL analysis. Team-colored poster slides are a deliberate exception to the neutral surface system.

Avoid neon effects, glass, broad gradient washes, oversized rounding, generic grids of equal dashboard tiles, decorative icons beside every heading, and stock UI type used as the main display voice.

## 4. Base tokens

Current application values from `src/v2.css`:

| Token | Value | Role |
| --- | --- | --- |
| `--bg` | `#191B1C` | App background |
| `--base` | `#121414` | Navigation/base surface |
| `--panel` | `#202323` | Bordered content surface |
| `--raised` | `#2B2E2E` | Raised control/state surface |
| `--line` | `#393D3C` | Primary border/divider |
| `--soft-line` | `#303433` | Quiet table dividers |
| `--text` | `#F6F4ED` | Warm white foreground |
| `--muted` | `#B0B5B0` | Supporting copy |
| `--dim` | `#929A94` | Lower-emphasis metadata |
| `--orange` | `#FFA166` | NBA action and selection |
| `--orange-ink` | `#23180F` | Text on orange controls |
| `--orange-ground` | `#32261B` | Muted NBA surface |
| `--green` | `#A4DCAE` | FPL accent and positive status |
| `--green-ground` | `#223729` | FPL supporting surface |
| `--red` | `#FFB3A5` | Error/urgent feedback |
| `--radius` | `8px` | Content panels |
| `--gap` | `24px` | Default layout gap |
| `--fast` | `180ms` | Small interaction transition |
| `--ease` | `cubic-bezier(.2,.8,.2,1)` | Default ease |

The landing page uses `#171A18` as its near-charcoal ground, a 1320px content maximum, fluid side padding `clamp(20px,4vw,64px)`, and section spacing `clamp(64px,8vw,128px)`.

Color never carries state alone: pair NBA/FPL color with sport names, queue color with a check, errors with text, and turn color with an explicit message.

## 5. Typography

### Families and roles

| Role | Family | Source alias | Fallback |
| --- | --- | --- | --- |
| Headlines, editorial display, large numerals | Barlow Condensed | `Fanatics Display` | Impact, sans-serif |
| Body, navigation, forms, table labels | DM Sans | `Fanatics Sans` | system-ui, sans-serif |

Fonts are localized in `assets/fonts/` and embedded by the current build. Use only these two families for product UI. Normal body is weight 400; emphasis/UI is 500; display/buttons use 600. The wordmark is an existing heavier exception.

### Recommended extension scale

Use a 1.25-based scale with eight core roles: 11 / 14 / 16 / 20 / 25 / 32 / 48 / 64px. Reserve larger fluid type for the marketing hero. Body uses 1.5–1.6 leading and a 50–75-character measure. Small text uses 1.5 leading. Display uses 1.0–1.2 leading for new work.

Set body tracking to 0; small metadata to .01–.02em; UI labels/buttons to .02em. Uppercase labels use .06–.1em. Mixed-case display headings use -.01–-.03em. Do not inherit Latin negative tracking onto CJK text; CJK display requires 1.3–1.4 leading and zero tracking.

### As-built editorial exceptions

The current landing hero intentionally uses `clamp(64px,8.4vw,124px)` and .88 line height; its display sections commonly use 40–68px condensed type. Several miniature product-demo captions and metadata values are below the preferred scale. These are recorded as existing values, not a blanket accessibility claim. When extending full application screens, use the readable core scale rather than copying miniature demo labels. Do not change the approved layout silently as a side effect of documentation work.

Use tabular numerals for pick counts, clocks, prices, and statistical comparisons. Keep units attached to their values. Player names wrap fully in detail views; a shortened list name must have an accessible route to its full value.

## 6. Spacing, surfaces, and layout

Use a 4px foundation: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64 / 80 / 128px. Prefer 24–32px between desktop workspace regions and 16–24px on mobile. Panels usually have 20–28px padding, a 1px border, and an 8px radius; controls use 3–5px radii. Pill/circle shapes are reserved for avatars, playback dots, and appropriate small status elements.

Keep primary regions in normal flex/grid flow. Absolute positioning is reserved for anchored/decorative items such as a jersey numeral or court linework. Photos retain the verified 520:380 ratio and render in full. Never stretch player portraits or crop the identifying face to force a layout.

Desktop uses horizontal app navigation with a secondary sport/league bar. The landing has its own public navigation. Shared app navigation remains in a predictable place; mobile uses a menu rather than squeezed desktop links.

## 7. Team-themed featured-player carousel

The same poster composition is used for every featured player. Team identity changes the background, name panel, chrome, accent, muted foreground, and court/border line colors. All values are team-inspired UI adaptations, not an assertion of exact official brand specifications.

| Player / team | Background | Name panel | Chrome | Accent | Muted text | Border |
| --- | --- | --- | --- | --- | --- | --- |
| Shai / OKC | `#07659E` | `#063C65` | `#082B49` | `#FFAD70` | `#D0E6F4` | `#4F91B8` |
| Jokić / DEN | `#142B4B` | `#102139` | `#0C1A2C` | `#F4CA67` | `#D1DEEF` | `#526886` |
| Giannis / MIA | `#98002E` | `#530C22` | `#1B1418` | `#FFCB66` | `#F4D9DB` | `#A05160` |
| Dončić / LAL | `#542D83` | `#3A205E` | `#291943` | `#FFD15F` | `#E6D8F6` | `#8C70AA` |
| Edwards / MIN | `#183B57` | `#102A40` | `#0B2032` | `#BCDF68` | `#CCDEE9` | `#53778A` |
| Curry / GSW | `#1857A5` | `#10396E` | `#0C294F` | `#FFD65A` | `#D1E3FB` | `#5B87BE` |

Giannis is shown as Miami, following the user correction and the official NBA player profile consulted during the update: https://www.nba.com/player/203507/giannis-antetokounmpo. His official headshot was refreshed on 25 October 2026. Historical sample statistics are still labeled separately.

Poster anatomy: sport/header band → full-frame player portrait over court linework → jersey numeral and team/position → two-line player name → PTS/REB/AST strip → navigation/playback controls. Use dark or light foregrounds deliberately for each palette; do not inherit a previous player's contrast assumptions.

Carousel behavior:

- Start with Shai and six named slides, not an implied live ranking.
- Advance every 5 seconds only while visible, active, and not paused.
- Pause on hover, manual selection, keyboard interaction, hidden tab, and offscreen state.
- Support previous/next, named selection dots, count, play/pause, keyboard arrows/Home/End, and horizontal swipe.
- Manual selection pauses until explicitly resumed.
- Disable automatic rotation under reduced motion; retain manual controls.
- Animate the whole data group so portrait, name, number, team, and stats stay together. Incoming/outgoing slides retain their own palette.
- Reserve a stable two-line name area and image ratio so slide changes do not shift surrounding content.

Implementation: `src/PlayerCarousel.tsx`; layout overrides: `src/landing.css`.

## 8. Page architecture

Routes are hash-based inside `sports-fanatics-v2.html`:

| Page | Route | Primary action / responsibility |
| --- | --- | --- |
| Public landing | `#/` | Create league; explain NBA/FPL |
| Returning-user Home | `#/home` | Enter an existing league or create/join |
| NBA league index | `#/nba` | Select/manage a league |
| Create league | `#/nba/create` | Validate settings and create a private league |
| Join league | `#/nba/join` | Validate invite code and join with a team |
| Lobby | `#/nba/leagues/:id/lobby` | Invite, inspect readiness, start as creator |
| Live draft | `#/nba/leagues/:id/draft` | Scout, queue, select, track turns |
| Recap | `#/nba/leagues/:id/recap` | Inspect completed rosters, return to leagues |
| FPL Assistant | `#/fpl` | Compare a replacement with keeping the squad |
| Profile/settings | `#/settings` | Edit identity/preferences, reset local data |

URL updates occur after local view state is committed. Back/Forward synchronize the page; a sandboxed URL failure must not block local navigation. League-specific pages normalize to the league's actual lobby/live/complete status. Unknown league IDs show a recovery state.

## 9. Screen specifications

### Landing

Split desktop hero: concise proposition and actions on the left, team-colored player poster on the right. Primary message: **DRAFT NIGHT STARTS HERE.** Primary action: Create your league. Secondary: Explore the draft. Follow with the NBA product demo, three-step guide, FPL comparison introduction, FAQ, final create/join action, and complete footer. Product examples are labeled illustrative. Do not add fake customer counts, testimonials, or guaranteed outcomes.

### Home and NBA index

Home gives a returning-user overview; NBA index focuses on league management. Display league name, user's team, participant count, status, and correct entry action. Use actual state-derived counts. New-user empty states explain the missing data and offer create/join. Distinguish “lobby”, “live draft”, and “draft complete” in text.

### Create / join

One short form with persistent labels. Create: league name, team name, participant limit, roster size, pick timer. Join: invite code and team name. Reference defaults: 4 teams, 5-player rosters, 60 seconds. Supported choices are 2/4/6 teams, 3/4/5 players, 30/45/60/90 seconds. Validate missing names, bad invite codes, full leagues, and drafts that already started. Show progress on submission and open the lobby on success.

### Lobby

Participant roster, creator badge, team names, open positions, invite code/copy, settings, and clear status. Only the creator starts a full league. Explain the randomized snake order. The prototype's “add a friend's team” flow is local guest setup, not evidence of real remote membership.

### Live draft

Board above a two-column desktop workspace: player pool/search/filters/table on the left, selected player and personal roster/queue on the right. The orange current-turn banner is the strongest decision cue. Show next team, current pick, round, progress, and a clock formatted `MM:SS`.

Use any-position flexible roster slots in this release. Queue picks are personal and ordered; the first available queued player is the timeout fallback, followed by illustrative ranking. A drafted player becomes unavailable everywhere in that league immediately. Draft action is disabled on another user's turn, disconnection, or an unavailable player.

### Recap

Completed roster with pick/round context, automatic-pick notes, the user's recap, team selector, and return action. No season standings, invented scoring, winner, auction mode, or trophy messaging.

### FPL

Setup column + candidate table + recommendation panel. Edit the 15-player squad, select an outgoing midfielder in the current sample, selling price, budget, free transfers, other planned transfers, and horizon. Compare cost, expected points, fixtures, and minutes risk. Include keep-squad comparison and explicit points penalty. Explain uncertainty and affordability. “Save your transfer” is a first-class recommendation.

The current predictor is a sample heuristic, not an ML service. Fixture examples and points are illustrative; saving a plan does not change the official FPL game.

### Profile/settings

Display name, saved-profile feedback, reduced-motion preference, prototype/data explanation, and a confirmation before clearing local leagues. Do not imply an authenticated account exists.

## 10. Shared components

| Component | Structure | Required states |
| --- | --- | --- |
| Primary action | Solid orange / dark ink; green variant for FPL | Default, hover, focus, press, loading, disabled |
| Secondary action | Bordered, transparent/dark surface | Default, hover, focus, disabled |
| Form field | Visible label, input/select, helper/error | Empty, filled, focused, invalid, submitting |
| Player row | Rank, image/name, team/position, stats, queue | Default, selected, queued, drafted |
| Player detail | Identity, portrait, stat strip, action | Available, unavailable, your turn, waiting |
| Turn banner | Explicit turn label, next team, clock | Your turn, opponent turn, urgent, reconnecting |
| Draft board cell | Round/pick, player/team, availability | Empty, current, completed, automatic |
| Roster slot | Slot number, player or open slot | Empty, filled |
| Queue row | Priority, player, reorder, remove | Empty queue, first fallback, lower priority |
| League tile | Identity, occupancy, status, entry action | Lobby, live, complete |
| Avatar | Initials, deterministic color | Manager, current user, open spot |
| Status label | Short text + optional coherent icon | Creator, ready, live, error, pending |
| Dialog | Native dialog, heading, close, action | Invite, connection, squad edit, reset |
| Toast | Icon + concise result + dismiss | Success, informational pick, error |
| FPL verdict | Recommendation, keep/transfer totals, uncertainty | Transfer, keep, unaffordable, points hit, saved |

Use Lucide outline icons. Keep stroke weight consistent and size icons explicitly. Do not mix emoji or unrelated filled icon families. Preserve focus after dialogs and list mutations; controls should remain usable with keyboard and touch.

## 11. Interaction and state model

NBA local objects: `League`, `Participant`, `Pick`, and `Player`. League owns participant count, roster size, timer, membership, picks, status, and the local user's team index. Player ID uniqueness is enforced per league. The live turn is derived from the pick count and snake function rather than maintained as a conflicting second value.

The demonstration starts Sunday League with three picks complete; the user is fourth and also first in round two. Opponents make simulated picks after a short decision interval. The local clock runs only while the draft page is open. A production backend must own time/order and enforce atomic unique-player picks.

FPL sample calculation: penalty = 4 × max(0, 1 + other planned transfers − free transfers). Compare outgoing sample points × horizon against candidate sample points × horizon minus penalty. Recommend an affordable different candidate only if the illustrative gain exceeds 1.5. The displayed uncertainty band is illustrative, not calibrated confidence.

## 12. Required state coverage

- Home: populated and no leagues.
- Forms: untouched, missing required field, unknown invite, full league, draft started, submitting, success.
- Lobby: creator with open spots, ready creator, noncreator waiting.
- Draft: own turn, opponent turn, successful pick, timeout/automatic pick, reconnecting/offline, queue populated/empty, drafted player, empty filtered pool.
- Recap: user's roster and another selected team.
- FPL: replacement, keep recommendation, points hit, unaffordable move, saving/saved plan, editable squad, invalid squad.
- Profile: edited/saved display name, reduced motion, reset confirmation.

The canvas presents representative reference states and a coverage ledger. Not every possible form validation message or arbitrary user data permutation needs a separate artboard.

## 13. Responsive rules

Reference breakpoints: 1600+, 1200, 1024, 768, 375, and a narrow 320px fallback. Reorganize instead of shrinking all content.

- Landing: split hero → copy then player poster; content stories stack; FAQ stays a normal-flow accordion.
- App: horizontal navigation → mobile menu; league/sport context remains clear.
- Draft: desktop board/pool/detail/roster → focused Board / Players / Roster tabs. Keep the sticky turn banner visible. Board may scroll inside its labeled region; the entire page should not overflow horizontally.
- FPL: setup/sidebar and main comparison → stacked setup and comparison.
- Forms: two-column explanatory layout → form first, guidance second.
- Canvas: overview thumbnails → inspected responsive artboard. Canvas controls are documentation UI, not product chrome.

## 14. Motion and accessibility

Use the existing Motion for React package. Page changes are about 220ms; carousel slides about 240ms; small feedback about 180ms. Prefer transform/opacity. Enter ease is quick to respond and settles gently. Keep bigger UI transitions at or under 400ms. Never block interaction until an animation ends.

Honor `prefers-reduced-motion` and the in-app preference. Remove large transforms, disable autoplay, and keep meaningful static/short-fade feedback. Do not create a media film or audio as a side effect of interactive motion.

Accessibility targets: body contrast ≥4.5:1; large text/essential graphics ≥3:1; visible focus, semantic names, meaningful alt text, persistent field labels, adequate touch targets, full text access, and non-color state cues. These are implementation requirements, not a claim that a formal accessibility audit has been performed. Existing miniature reference UI contains intentionally small preview labels; extension work should use the readable core scale.

## 15. Source map and build

| Source | Responsibility |
| --- | --- |
| `src/v2.tsx` | Shared shell, routes, NBA/FPL/Profile views, state and actions |
| `src/Landing.tsx` | Public landing narrative, interactive preview, FAQ |
| `src/PlayerCarousel.tsx` | Featured players, team palettes, playback/input handling |
| `src/data.ts` | Sample players, leagues, FPL candidates, snake helpers |
| `src/v2-media.ts` | Embedded player-image data |
| `src/v2.css` | App tokens, shared components, responsive application styles |
| `src/landing.css` | Landing layout, carousel themes, creation/index page additions |
| `scripts/build-v2.mjs` | Bundle and render the current self-contained HTML entry |
| `assets/v2-players/credits.json` | Image sources, owner and rights notes |

`npm run build:v2` rebuilds the current entry. `npm run dev` serves the project; navigate to `/sports-fanatics-v2.html`. The default `npm run build` remains the earlier v1 bundle and does not regenerate v2.

Future FastAPI responsibilities include identity, role enforcement, persistent membership/queues, invitation validation, atomic draft operations, authoritative timer/event replay, and model-backed predictions. None are silently substituted for working services in this handoff.

## 16. Assets, truthfulness, and change discipline

Use the localized NBA imagery and retain its credits sidecar. NBA imagery remains copyrighted; no commercial redistribution rights are asserted. Use initials if a portrait is unavailable. Keep Giannis's Miami identity independent from the sample-stat season. Do not fabricate team changes, covers, photos, model results, user counts, or licensing claims.

Use the current prototype as the visual reference and this document as the shared system. Extend affected components coherently; do not restyle unrelated pages or erase user-approved choices. Record future data/provider integrations separately from visual changes.
