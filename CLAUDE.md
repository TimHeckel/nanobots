# nanobots

AI-native code scanner + SaaS platform. CLI scans repos with AI bots, SaaS provides GitHub App integration with chat-based management.

## Quick Start

```bash
npm run dev          # SaaS app on http://localhost:6100
npx tsx cli/index.ts list   # CLI: list bots
npm test             # Run all tests (114 tests)
npx tsc --noEmit     # Type check
```

## Architecture

Two surfaces, shared core:

- **CLI** (`cli/`): Local scanner using OpenRouter + any model. Commands: scan, list, describe, create, test, promote, init, auth.
- **SaaS** (`src/`): Next.js app with GitHub OAuth, chat interface using Vercel AI SDK streaming, 18 chat tools.
- **Shared core** (`src/lib/nanobots/ai-bots/`): Bot definitions, engine, lifecycle, registry, tool library. Used by both CLI and SaaS.

## Key Directories

```
cli/                          CLI entrypoint + commands
cli/bots/                     Local bot store + registry wrappers
cli/commands/                  scan, list, describe, create, test-bot, promote, init, auth
src/app/                       Next.js App Router pages + API routes
src/lib/chat/tools/            18 SaaS chat tool definitions (AI SDK tool())
src/lib/nanobots/ai-bots/     Shared bot platform core
  types.ts                     BotDefinition, BotFinding, BotStatus, etc.
  engine.ts                    generateText() execution with batching
  defaults.ts                  6 built-in bots as data
  registry.ts                  createRegistry() - merges built-in + user bots
  lifecycle.ts                 testBot, promoteBot, archiveBot, shadowRun
  tool-library.ts              Safe handler templates (fetch, regex, jsonpath, transform)
  bot-creator.ts               AI-powered bot creation from natural language
  adapter.ts                   BotDefinition -> SaaS Nanobot interface bridge
  prompt-refiner.ts            Background prompt evolution
src/lib/nanobots/              SaaS-specific: orchestrator, scanner, individual nanobots
src/lib/db/                    Neon Postgres schema + queries
src/lib/auth/                  GitHub OAuth + JWT sessions
tests/unit/                    90 unit tests (vitest)
tests/e2e/                     24 CLI e2e tests + browser e2e (agent-browser)
tests/e2e/helpers.ts           Browser test helpers (createBrowser, navigate, etc.)
.github/workflows/             CI (unit tests) + E2E (kernel.sh browser tests)
```

## Bot Lifecycle

```
draft -> testing -> active -> archived
```

- **draft**: Created via `create` command or SaaS chat. Manual test only.
- **testing**: Shadow mode on scans. Results visible to creator + admins.
- **active**: Runs on real scans. 6 built-in bots start here.
- **archived**: Deactivated. Historical data only.

CLI: `nanobots create "desc"` -> `nanobots test bot-name .` -> `nanobots promote bot-name`

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **AI**: Vercel AI SDK v6 (`ai`, `@ai-sdk/openai`, `@ai-sdk/react`) — all via OpenRouter
- **Validation**: Zod v4
- **DB**: Neon Postgres (`@neondatabase/serverless`)
- **Auth**: GitHub OAuth + JWT (`jose`)
- **GitHub**: Octokit (`@octokit/rest`, `@octokit/auth-app`)
- **Testing**: Vitest v4
- **CLI builds**: Bun compile

## AI SDK Conventions

- Tool definitions use `inputSchema` (not `parameters`) with Zod schemas
- `generateText()` for bot execution (non-streaming, agentic loop)
- `streamText()` for SaaS chat (streaming to client)
- `stopWhen: stepCountIs(n)` for tool-use iteration limits (not `maxSteps`)
- Both CLI and SaaS use `@ai-sdk/openai` with `baseURL: "https://openrouter.ai/api/v1"` (OpenRouter)
- SaaS model factory: `src/lib/llm/provider.ts` — `getModel()` returns the default model
- One API key (`OPENROUTER_API_KEY`) for both surfaces

## Environment Variables

Production env vars live in Vercel. Pull them locally with:
```bash
npx vercel env pull .env.local --environment production
```

`.env` has GitHub App credentials only. `.env.local` (gitignored) has the full set after pulling from Vercel.

Key vars:
- `OPENROUTER_API_KEY`: Model access (both CLI and SaaS, via OpenRouter)
- `GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY`: GitHub App auth
- `DATABASE_URL`: Neon Postgres connection
- `JWT_SECRET`: Session signing

## Testing

```bash
npm test                    # All tests (unit + CLI e2e, excludes browser)
npx vitest run tests/unit/  # Unit tests only (fast, ~300ms)
npx vitest run tests/e2e/   # E2E CLI tests (~40s, no API key needed for most)
npm run e2e                 # Browser e2e tests (requires running app or E2E_BASE_URL)
```

### Browser E2E (agent-browser + kernel.sh)

Browser tests use `agent-browser` with Playwright under the hood. Two modes:
- **Local**: `HEADED=1 E2E_BASE_URL=http://localhost:6100 npm run e2e`
- **CI**: `AGENT_BROWSER_PROVIDER=kernel KERNEL_API_KEY=xxx E2E_BASE_URL=https://nanobots.sh npm run e2e:ci`

Separate vitest config: `vitest.config.e2e.ts` (60s timeouts, 2 workers for rate limits).

### GitHub Actions

- `.github/workflows/ci.yml`: Push/PR -> type check + unit tests
- `.github/workflows/e2e-tests.yml`: Post-deploy or manual -> browser tests via kernel.sh
- Secrets needed: `KERNEL_API_KEY` (for kernel.sh browser provider)

## Conventions

- Bot definitions are data (JSON), not code. System prompts + config stored in `defaults.ts`.
- Informational CLI output goes to stderr. Structured data (JSON mode) goes to stdout.
- Error handling: engine catches per-batch errors, returns empty findings on failure.
- Registry pattern: `createRegistry(userBots)` merges built-in + user bots. User bots override by name.
- All bot lifecycle transitions are immutable (return new objects).
