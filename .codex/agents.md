# Sports Fanatics contributor guidance

- Frontend: React, TypeScript, Vite, Tailwind. Backend: Python, FastAPI, uv.
- Follow `docs/design/DESIGN.md` and `docs/design/MASTER-PROMPT.md` for product and visual requirements. These are reference documents; their old prototype source paths/build commands do not describe this repository.
- Preserve the charcoal editorial design, Barlow Condensed/DM Sans typography, orange NBA accents, and green FPL accents.
- Keep components, page views, sample data, and state transitions separate. Derive snake turns from pick counts; enforce unique player assignments within each league.
- Label local guests, simulated draft activity, sample statistics, and heuristic FPL predictions honestly. No authentication, multiplayer, or model inference claims until backed by services.
- Maintain keyboard access, visible focus, reduced motion, mobile draft tabs, and storage-unavailable recovery.
- Split completed work into meaningful commits using Conventional Commits. Do not commit unrelated changes or secrets.
- Before handing off frontend changes, run `npm run lint`, `npm run test`, and `npm run build` in `frontend/`. Run browser checks for affected flows and mobile layouts.
- Keep this file tracked so the guidance is shared. Root `AGENTS.md` links here for tool discovery.
