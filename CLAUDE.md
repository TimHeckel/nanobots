# nanobots.sh

AI-native code scanning platform. Scans GitHub repos with LLM-powered bots, opens fix PRs, and monitors dependencies for threats. Two surfaces: a SaaS web app (chat-driven) and a standalone CLI.

## Architecture

### Dual-Surface Design
- **SaaS** (`src/`): Next.js 16 app on Vercel. GitHub App integration. Chat UI is the primary control plane — users manage bots, scans, swarms, webhooks, and docs through a conversational interface backed by 24 chat tools.
- **CLI** (`cli/`): Bun-compiled binary. Runs scans locally against a directory. Bot lifecycle management (create, test, promote). Interactive chat mode.

### Core Engine (`src/lib/nanobots/`)
- `ai-bots/defaults.ts` — 6 built-in bots: security-scanner, code-quality, actions-hardening, readme-generator, architecture-mapper, api-doc-generator
- `ai-bots/engine.ts` — Batch execution engine. Files filtered by extension, chunked by byte limit, sent to LLM with structured JSON output parsing
- `ai-bots/adapter.ts` — Bridges `BotDefinition` (data-driven) to `Nanobot` interface (orchestrator-compatible)
- `ai-bots/types.ts` — Bot lifecycle: draft -> testing -> active -> archived
- `orchestrator.ts` — SaaS scan runner. Fetches repo tree via GitHub API, runs bots, opens PRs/issues via Octokit

### Watchtower (`src/lib/watchtower/`)
Threat intelligence system. Queries OSV, GitHub Advisory, HackerNews, and CISA KEV. Matches advisories against repo dependencies. Auto-creates issues and version-bump PRs. Generates prompt proposals for affected bots.

### Compliance (`src/lib/compliance/`)
Sprinto SOC 2 integration. Converts scan activity logs into engineering control entities and pushes them to Sprinto's Push API.

### Webhooks (`src/lib/webhooks/`)
Event dispatcher. Signs payloads with HMAC-SHA256, delivers to registered endpoints, logs deliveries. Fire-and-forget pattern.

### Chat Tools (`src/lib/chat/tools/`)
24 tools exposed to the chat LLM via AI SDK `tool()`. Each tool is a closure capturing `orgId`/`userId`/`role` for auth. Covers: bot CRUD, scan operations, swarm management, webhook config, doc generation, onboarding, proposals, team invites.

### Swarms
Named groups of bots that run together. Managed via chat tools (createSwarm, listSwarms, manageSwarm, runSwarm).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Runtime | Node.js 22 (SaaS), Bun (CLI) |
| AI | AI SDK v6, OpenRouter (all models) |
| Database | Neon Postgres (serverless) |
| Auth | GitHub OAuth + JWT sessions |
| GitHub | Octokit (GitHub App with installation tokens) |
| UI | React 19, Tailwind CSS v4 |
| Testing | Vitest (unit, integration, e2e), agent-browser (browser e2e) |
| Deploy | Vercel |

## Key Conventions

### AI SDK v6
- `tool()` uses `inputSchema` (Zod), not `parameters`
- `generateText()` uses `stopWhen: stepCountIs(n)`, not `maxSteps`
- `streamText()` result: `toUIMessageStreamResponse()` for `useChat()` compatibility
- Tool call properties: `input` (not `args`), `output` (not `result`), `ModelMessage` (not `CoreMessage`)
- CRITICAL: `openai.chat(modelId)` NOT `openai(modelId)` — default callable uses Responses API which OpenRouter doesn't support

### OpenRouter
- Single provider for both CLI and SaaS
- Model IDs: `anthropic/claude-sonnet-4.5` (slash format, not dashes)
- Env var: `OPENROUTER_API_KEY`
- SaaS model factory: `src/lib/llm/provider.ts` -> `getModel()`

### CLI Output
- Informational output -> stderr (colors, progress, prompts)
- Structured data (JSON mode) -> stdout

### Testing
- `vi.mock("ai")` to mock `generateText` with `vi.clearAllMocks()` in `beforeEach`
- CLI e2e: `spawnSync` with `shell: true` to capture both stdout AND stderr
- Bot lifecycle tests: temp directories with `mkdtemp` + cleanup in `afterAll`
- Browser e2e: `agent-browser` with `BrowserManager`, kernel.sh for CI

## Project Structure

```
cli/                    # Standalone CLI (Bun)
  commands/             # scan, list, describe, create, test, promote, chat, init, auth
  bots/                 # local-store for .nanobots/bots/*.json
src/
  app/                  # Next.js App Router
    api/                # REST endpoints
      chat/             # Chat streaming endpoint
      scan/             # Manual scan trigger
      webhooks/github/  # GitHub App webhook receiver
      cron/watchtower/  # Scheduled threat scanning
      auth/             # GitHub OAuth flow
      conversations/    # Chat persistence
      admin/            # Platform admin (system prompts)
      compliance/       # Sprinto export
    chat/               # Chat UI pages
    onboarding/         # Onboarding flow
  lib/
    nanobots/           # Core bot engine + orchestrator
      ai-bots/          # Bot definitions, engine, adapter, lifecycle, tools, events
    watchtower/         # Threat intelligence
    webhooks/           # Event dispatcher
    compliance/         # Sprinto SOC 2
    chat/               # Chat tools (24) + system prompt builder + context
    db/                 # Schema types + query modules (Neon)
    auth/               # Session, OAuth, platform admin
    llm/                # Provider factory, analyzer
    github.ts           # Octokit helpers (App auth, tree, file content, PRs)
tests/
  unit/                 # ~90 unit tests
  e2e/                  # CLI + browser e2e tests
  integration/          # DB-dependent tests
```

## How to Run

```bash
# SaaS dev server
npm run dev              # http://localhost:6100

# CLI dev
bun run cli/index.ts scan .
bun run cli/index.ts chat

# Tests
npm test                 # Unit tests
npm run e2e              # E2E tests
npm run test:integration # Integration tests (needs DATABASE_URL)

# Build
npm run build            # Next.js build
npm run cli:build        # Compile CLI binary
```

## Environment Variables

See `.env.example` for full list. Key ones:
- `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY` — GitHub App credentials
- `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET` — OAuth
- `DATABASE_URL` — Neon Postgres
- `OPENROUTER_API_KEY` — AI provider
- `JWT_SECRET` — Session signing
- `CRON_SECRET` — Watchtower cron auth

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`):
- Unit & CLI tests (Node 22, `npm test`)
- Integration tests (`npm run test:integration` with DB secrets)
- Lint (`npm run lint`)
- Type check (`npx tsc --noEmit`)

Separate e2e workflow (`.github/workflows/e2e-tests.yml`) for browser tests.

## Database

Neon Postgres (serverless). No ORM — raw SQL queries in `src/lib/db/queries/`. Schema types in `src/lib/db/schema.ts`. Tables: users, organizations, org_members, org_repos, bot_configs, system_prompts, prompt_proposals, scan_results, activity_log, chat_messages, conversations, invitations, api_keys, webhook_endpoints, webhook_deliveries, swarms, swarm_bots, doc_generations.
