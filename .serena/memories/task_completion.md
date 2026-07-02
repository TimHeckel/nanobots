# Task completion checklist

When finishing work in this repo, choose the smallest relevant validation set that matches the touched area, then expand if risk is higher.

- Always consider `npm run lint` for TypeScript/Next changes.
- For shared bot/CLI logic (`cli/**`, `src/lib/nanobots/**`, command handlers), run `npm test` and any directly relevant targeted suite.
- For database-backed or server route changes, run `npm run test:integration` if the required env (`DATABASE_URL`, `JWT_SECRET`, possibly `OPENROUTER_API_KEY`) is available.
- For browser/app flow changes, run `npm run e2e` when feasible; note it is slower and expects the app/test environment to be available.
- For agent-browser / provider-specific flows, run `npm run test:agents` when touching those tests or related behavior.
- For build-sensitive app changes, run `npm run build` before handing off if time/risk warrants it.
- If a required env var is missing and blocks validation, state that explicitly in the handoff.
- README is stale; if user asks for docs updates, update README or point them to `docs/ai-bots-platform.md` as the accurate source.