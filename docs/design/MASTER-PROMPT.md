# Sports Fanatics — Master Build Prompt

Use this prompt with `DESIGN.md`, `design-canvas.html`, and the editable reference prototype `sports-fanatics-v2.html`. Build on the current product rather than replacing it with a generic sports dashboard.

## Objective

Design and implement **Sports Fanatics**, a responsive sports platform with two distinct experiences under one brand:

1. **NBA Fantasy Draft:** private leagues where friends each manage one team and draft NBA players.
2. **FPL Assistant:** a planning companion to the existing Fantasy Premier League game, helping users compare transfers with keeping their squad.

Prioritize the NBA draft experience. The product should feel competitive, social, confident, and welcoming to casual fans. Preserve the approved landing page, featured NBA player carousel, shared application shell, and distinct page structure.

## Deliverable and stack

Use React and TypeScript, reusable components, centralized design tokens, and Tailwind CSS where appropriate. The intended backend is Python with FastAPI. Distinguish prototype interactions from real services: do not claim authentication, cross-device persistence, real multiplayer, live FPL import, or ML inference unless those services are actually implemented.

Keep the application editable and runnable. The current reference uses an HTML entry with embedded React code, CSS, fonts, imagery, and rendered initial content to avoid blank previews. Preserve an immediately visible entry. Do not leave only an empty root that depends on a remote module or CDN.

## Visual direction

Use a modern sports editorial aesthetic: charcoal surfaces, warm white text, confident condensed display typography, restrained orange NBA accents, and green FPL accents. Balance compact statistics with generous space around decisions. Use Barlow Condensed for display typography and DM Sans for body/UI typography, with sensible local/system fallbacks.

Avoid neon, glassmorphism, excessive gradients, meaningless metrics, invented endorsements, and repetitive dashboard cards. Use one coherent outline icon family. Use real player photography with neutral initials fallbacks; do not generate likenesses or fabricate real player imagery. Store image sources and rights notes beside assets.

Preserve the featured player poster: basketball-court linework, large jersey numeral, full-frame portrait, team/position label, two-line player name, and points/rebounds/assists strip. Each featured player has a coordinated team-inspired background, dark panel, accent, court line color, and readable text.

The current carousel features Shai Gilgeous-Alexander / OKC, Nikola Jokić / DEN, Giannis Antetokounmpo / MIA, Luka Dončić / LAL, Anthony Edwards / MIN, and Stephen Curry / GSW. Giannis uses Miami Heat red, black, and gold. Team identity and statistical season are separate: the existing figures remain clearly labeled **2024/25 sample stats**. Verify current affiliations and headshots before a future live-data release; do not imply this list is a live player ranking.

## Information architecture

Create distinct, directly addressable pages sharing reusable components:

| Page | Reference route | Purpose |
| --- | --- | --- |
| Landing | `#/` | Introduce the product and lead visitors into creating a league |
| Home | `#/home` | Returning-user home: leagues, upcoming drafts, and FPL entry |
| NBA Fantasy | `#/nba` | League management and league selection |
| Create league | `#/nba/create` | Short creation form |
| Join league | `#/nba/join` | Invite code and team-name form |
| League lobby | `#/nba/leagues/:id/lobby` | Participants, invitations, readiness, and settings |
| Live draft | `#/nba/leagues/:id/draft` | The main draft workspace |
| Draft recap | `#/nba/leagues/:id/recap` | Completed rosters and selection recap |
| FPL Assistant | `#/fpl` | Squad setup and transfer comparison |
| Profile & settings | `#/settings` | Identity, preferences, and local-data controls |

The standalone reference uses hash routes. A hosted application may use pathname routes if the server supports refresh/deep-link fallback. Update page state immediately; handle browser Back and Forward. If URL mutation is blocked in a preview, local navigation must still work. Preserve form input and draft state across navigation. Show a useful unavailable-league state for unknown league IDs.

### Public landing page

The landing page is the default entry, separate from the returning-user Home page. Preserve its narrative:

1. Clear brand navigation: NBA Fantasy, FPL Assistant, How it works, and Open app.
2. Bold **“DRAFT NIGHT STARTS HERE.”** hero. Supporting message: the group chat has opinions; give it a league to settle them.
3. Primary **Create your league** action; secondary **Explore the draft** action.
4. Team-themed NBA player carousel with official local portraits and sample statistics.
5. NBA product demonstration with available-player and draft-board tabs, plus a real path to the draft room.
6. Three-step explanation: create a league, invite friends, draft your team.
7. Smaller FPL introduction showing keep-versus-transfer thinking, uncertainty, and the possibility of saving a transfer.
8. Useful FAQ accordion, final invitation to create/join, and a complete footer.

Carousel behavior: rotate every five seconds while visible and active; pause on hover, keyboard/manual interaction, hidden browser tab, or leaving the viewport. Provide arrows, player-selection dots, slide count, play/pause, keyboard arrows/Home/End, and horizontal swipe without blocking vertical scrolling. Use reduced-motion preferences to disable automatic rotation and large transforms. Keep photo, name, jersey number, team, palette, and stats synchronized. Reserve stable space so different names do not move the page.

### Shared app shell and Home

Inside the app, keep Home, NBA Fantasy, FPL Assistant, and Profile/settings in consistent navigation. Make the active sport explicit. Show a league switcher in league-specific NBA pages. On smaller screens use the existing responsive menu; do not cram the full desktop navigation into a narrow viewport.

Home shows the user's leagues and upcoming drafts, clear create/join actions, and a smaller FPL entry. New users see an inviting empty state with a meaningful next step.

### Create and join

Creating requires league name, team name, participant limit, roster size, and time per pick. Current prototype options: 2/4/6 teams, 3/4/5 players per roster, and 30/45/60/90 seconds per pick. Joining requires an invite code and team name. Validate required fields, unknown codes, full leagues, and drafts that already started. Show in-progress and success feedback. Open the resulting lobby after success.

### League lobby

Show participant names, team names, creator identity, ready/open spots, invite controls, private league code, settings, and draft status. Only the creator may start, once the participant limit is filled. Explain randomized starting order and reversal every round. The current local prototype can add guest teams; label simulated managers clearly. Do not imply an invite code connects real remote users without a backend.

### Live NBA draft

Desktop must show:

- Board with teams, rounds, completed picks, current pick, and snake direction.
- Searchable player pool with position and NBA-team filters.
- Player rows with photo, name, team, position, points, rebounds, assists, availability, and queue action.
- Personal roster with filled and remaining flexible slots.
- Current-turn message, next manager, round/pick progress, and a prominent countdown.
- Player details with an explicit draft action; disable drafting when unavailable, disconnected, or not the user's turn.
- Personal queue, removal, and ordering controls.

Snake order for four managers is A → B → C → D, then D → C → B → A. For zero-based pick `p` and `n` teams: round = floor(p / n); select p % n on even rounds and n − 1 − (p % n) on odd rounds. Maintain a unique player assignment within each league. A player may exist in different leagues.

When a pick is committed, update the board, player availability, roster, queue, pick count, and next turn from the same state. If time expires, choose the first still-available queued player, otherwise the first available illustrative ranking. Clearly announce automatic picks. Reconnection must preserve visible draft/queue state. Do not invent a winner, standings, or season scoring. Auction drafting is outside the initial release.

Include waiting, on-your-turn, picked successfully, timer-expired/automatic-pick, reconnecting/offline, unavailable player, empty search, and empty queue states. The prototype simulates opponents and pauses its clock outside the draft page; a real server would own the authoritative clock and order.

### Draft complete

Show complete rosters, the user's selections and pick numbers, automatic-pick indicators, and a team selector to inspect other teams. Include a clear return path. State that season scoring remains undefined; do not produce standings or awards.

### FPL Assistant

Let users enter/edit their 15-player squad, selling price, bank balance, free transfers, other planned transfers, and planning horizon in gameweeks. The reference offers 1/2/4/6 gameweeks and a small illustrative midfielder candidate pool. Communicate that scope honestly rather than suggesting full-squad live inference.

Allow an outgoing player and candidate replacements to be compared using cost, illustrative expected points, sample fixtures, and playing-time risk. Compare the transfer with keeping the squad. Display points penalties explicitly and include them in net benefit. An unaffordable replacement must not be recommended. Saving the transfer is a valid outcome. Explain recommendations in plain language and show uncertainty, not false certainty. Saving a plan never changes an official FPL account.

The prototype calculation is an illustrative heuristic, not an ML model: multiply sample per-gameweek points by the horizon; subtract 4 points for each transfer beyond available free transfers; compare against keeping the current player. The current rule recommends an affordable different player only when the net illustrative gain exceeds 1.5 points. Do not present this threshold or the sample point ranges as validated model performance.

## Responsive behavior and accessibility

Support wide desktop, tablet, and at least 375px mobile widths. Reflow the landing hero and informational sections into a deliberate single column. Mobile drafting uses focused Board, Players, and Roster tabs; the active pick and clock remain visible. Keep essential controls reachable without page-level horizontal scrolling; a labeled internal board scroller is acceptable.

Use semantic controls, persistent form labels, visible focus, meaningful alt text, reduced motion, and text/icon cues alongside color. Body text should be at least 16px; keep metadata readable and avoid reproducing miniature preview typography as full application text. Aim for body contrast of at least 4.5:1 and essential graphics/large text at least 3:1. Use touch targets of at least 44px wherever practical. Maintain logical reading/focus order and full-name access for shortened data.

## Motion

Use the existing Motion for React stack. Most interactions take 150–300ms; larger transitions stay at or below 400ms. Animate transform/opacity and preserve interruptibility. Motion should explain navigation, turn changes, pick confirmation, or queue changes. Provide a static or short-fade reduced-motion alternative. No moving page backgrounds, compulsory parallax, or animation that hides essential content.

## Source and backend boundaries

The current source lives in `src/v2.tsx`, `src/Landing.tsx`, `src/PlayerCarousel.tsx`, `src/data.ts`, `src/v2.css`, and `src/landing.css`. `src/v2-media.ts` contains embedded local player images. `scripts/build-v2.mjs` creates the self-contained prototype; `npm run build:v2` rebuilds it. The original `npm run build` targets the older first prototype, not the current one.

Future FastAPI work should provide real identity, league membership/roles, secure invitations, an atomic unique-player pick operation, persistent queues, an authoritative draft clock, live event/reconnection synchronization, and versioned prediction outputs with uncertainty and provenance. These are implementation requirements for a production service, not capabilities delivered by the current prototype.

Preserve the latest visual decisions and do not add authentication screens, paid tiers, auction UI, standings, a video export, or another redesign unless separately requested. Keep illustrative content labeled and report actual delivered files and remaining service gaps truthfully.
