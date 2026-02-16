# AI Bots Platform: Architecture & Implementation

## Overview

The AI Bots Platform is a data-driven bot system that powers both the nanobots CLI and SaaS application. Bots are defined as structured data (system prompts + tools + pipeline + config) rather than code, and are executed through the Vercel AI SDK's `generateText()` function.

The platform introduces a **promotion lifecycle** (`draft -> testing -> active -> archived`) so bots are validated before running in production.

## Core Design Principles

1. **Bots as data**: A `BotDefinition` is a JSON structure containing a system prompt, tool definitions, config, and lifecycle metadata. No code execution — just data that drives the AI SDK.

2. **Provider agnostic**: The engine accepts any Vercel AI SDK `LanguageModel`. CLI uses `@ai-sdk/openai` pointed at OpenRouter. SaaS uses `@ai-sdk/anthropic`. Same engine, different providers.

3. **Shared core, two surfaces**: `src/lib/nanobots/ai-bots/` is imported by both `cli/` and `src/app/`. No code duplication between CLI and SaaS.

4. **Safe tool handlers**: Bot tools use pre-approved handler templates (fetch, regex, jsonpath, transform) instead of arbitrary code execution. Custom JS handlers require explicit promotion.

---

## Type System (`types.ts`)

### BotDefinition

The central type that represents a bot:

```typescript
interface BotDefinition {
  name: string;              // Unique identifier, kebab-case
  description: string;       // Human-readable description
  category: string;          // "security" | "quality" | "docs" | custom
  systemPrompt: string;      // Full system prompt sent to the LLM
  tools?: ToolDefinition[];  // Optional tools the bot can use
  pipeline?: PipelineDefinition;  // Optional pre/post processing
  outputSchema?: Record<string, unknown>;
  config: BotConfig;         // File extensions, batch size, etc.
  status: BotStatus;         // "draft" | "testing" | "active" | "archived"
  source?: "built-in" | "user" | "autonomous";
  createdAt?: string;        // ISO timestamp
  promotedAt?: string;       // ISO timestamp of last promotion
}
```

### BotFinding

Standard output format for scanner bots:

```typescript
interface BotFinding {
  file: string;
  line?: number;
  severity: "critical" | "high" | "medium" | "low" | "info";
  category: string;
  description: string;
  suggestion?: string;
  fixedContent?: string;  // Full corrected file content (for --fix mode)
}
```

### BotConfig

```typescript
interface BotConfig {
  fileExtensions?: string[];     // File types this bot analyzes
  outputFormat?: "findings" | "document" | "report";
  maxFilesPerBatch?: number;     // Default: 15
  maxSteps?: number;             // Tool-use iteration limit (default: 5)
  enabled?: boolean;
  [key: string]: unknown;        // Extensible
}
```

---

## Engine (`engine.ts`)

The execution engine is the heart of the platform. It takes a `BotDefinition`, a list of files, and a model, then returns findings.

### Execution Flow

```
1. Filter files by extension
2. Batch files (by count AND byte size, max 50KB per batch)
3. For each batch:
   a. Instantiate bot's tools as AI SDK tool() objects
   b. Call generateText() with system prompt + user prompt + tools
   c. Parse JSON findings from response
4. Merge and return all findings
```

### Key Functions

**`executeBot(bot, files, model)`** — Main entry point.

```typescript
async function executeBot(
  bot: BotDefinition,
  files: RepoFile[],
  model: LanguageModel,
): Promise<BotFinding[]>
```

**`filterByExtensions(files, extensions)`** — Filters files by extension. Returns all files if no extensions specified.

**`batchFiles(files, maxPerBatch)`** — Groups files into batches respecting both count limit and 50KB byte limit.

**`buildUserPrompt(bot, files)`** — Constructs the user prompt with file contents and JSON output format instructions.

**`parseFindings(text)`** — Parses the LLM's JSON response. Handles:
- Clean JSON
- Markdown-fenced JSON (`` ```json ... ``` ``)
- Invalid JSON (returns empty array)
- Invalid severity values (defaults to "medium")

### AI SDK Integration

The engine uses `generateText()` (not `streamText()`) because bot execution is batch processing, not interactive streaming. When a bot has tools defined, it enables the agentic tool-use loop:

```typescript
const { text } = await generateText({
  model,
  system: bot.systemPrompt,
  prompt: buildUserPrompt(bot, batch),
  tools: hasTools ? tools : undefined,
  stopWhen: hasTools ? stepCountIs(bot.config.maxSteps ?? 5) : undefined,
});
```

Note: AI SDK v6 uses `stopWhen: stepCountIs(n)` instead of the deprecated `maxSteps` parameter.

---

## Tool Library (`tool-library.ts`)

Pre-approved, safe handler templates that bot tools map to. Each handler is a factory function that takes a config and returns an executor.

### Available Handlers

| Handler | Config | Description |
|---------|--------|-------------|
| `fetch` | `{ urlTemplate: string }` | HTTP GET with parameter interpolation |
| `regex` | `{ pattern: string, flags?: string }` | Regex match against content |
| `jsonpath` | `{ paths: string[] }` | Extract dot-path values from JSON |
| `transform` | `{ operation: string, delimiter?: string }` | split, lines, identity |

### How It Works

A `ToolDefinition` in a bot maps to a handler:

```typescript
{
  name: "checkCVE",
  description: "Check if a package has known CVEs",
  parameters: {
    packageName: { type: "string", description: "npm package name" },
    version: { type: "string", description: "semver version" }
  },
  implementation: "fetch",
  implementationConfig: {
    urlTemplate: "https://api.osv.dev/v1/query?package={packageName}&version={version}"
  }
}
```

`instantiateTool()` converts this to a Vercel AI SDK `tool()`:

1. Builds a Zod schema from `parameters` (string, number, boolean, array types)
2. Looks up the handler factory by `implementation`
3. Creates the handler with `implementationConfig`
4. Returns `tool({ description, inputSchema, execute })`

---

## Built-in Bots (`defaults.ts`)

6 pre-vetted bots that ship with nanobots. All are `status: "active"`, `source: "built-in"`.

| Bot | Category | Description |
|-----|----------|-------------|
| `security-scanner` | security | Hardcoded secrets, injection vulnerabilities, OWASP Top 10 |
| `code-quality` | quality | Dead code, unused imports, console pollution, code smells |
| `actions-hardening` | security | GitHub Actions: unpinned actions, script injection, excessive permissions |
| `readme-generator` | docs | Generates comprehensive README.md from repo contents |
| `architecture-mapper` | docs | Generates architecture docs with Mermaid.js diagrams |
| `api-doc-generator` | docs | Generates API endpoint docs with curl/fetch examples |

Each bot is a full `BotDefinition` with:
- Detailed system prompt (specific to its domain)
- File extension filters
- Batch size tuned to the task
- Output format (findings, document, or report)

---

## Registry (`registry.ts`)

Loads and manages bots at runtime. Merges built-in bots with user-created bots.

```typescript
const registry = createRegistry(userBots);

registry.getAll();              // All bots (built-in + user)
registry.getByName("my-bot");   // Single bot by name
registry.getActive();           // Only status: "active"
registry.getTesting();          // Only status: "testing"
registry.getByCategory("docs"); // Filter by category
registry.add(newBot);           // Add dynamically
registry.update(name, bot);     // Update existing
registry.remove(name);          // Remove
```

**User bots override built-in bots by name.** If a user creates a bot named `security-scanner`, it replaces the built-in one in their registry.

---

## Lifecycle (`lifecycle.ts`)

### Promotion Flow

```
draft ──promoteBot()──> testing ──promoteBot()──> active
                                                    │
                                              archiveBot()
                                                    │
                                                    v
                                                archived
```

**`promoteBot(bot)`** — Immutable. Returns a new `BotDefinition` with the next status and updated `promotedAt` timestamp. Throws if already active or archived.

**`archiveBot(bot)`** — Immutable. Returns a new `BotDefinition` with `status: "archived"`.

**`testBot(bot, files, model)`** — Runs a bot against files and returns a `TestResult` with findings, timing, and success status.

**`shadowRun(bot, files, model)`** — Same as `testBot` but returns a `ShadowResult` (no success/error — just the data for evaluation).

**`canPromote(bot, testResults?)`** — Checks if a bot is eligible for promotion:
- `draft -> testing`: Requires at least 1 successful test
- `testing -> active`: Requires 1+ successful tests with all passing

---

## Bot Creator (`bot-creator.ts`)

AI-powered bot creation from natural language descriptions.

```typescript
const bot = await createBotFromDescription(
  "Find TODO comments and classify them by urgency",
  model,
);
// Returns a BotDefinition with status: "draft", source: "user"
```

Uses `generateText()` with a meta-prompt that instructs the LLM to design a bot definition. Parses the response as JSON (handles markdown fencing). Always sets:
- `status: "draft"` (safety: never auto-active)
- `source: "user"`
- `createdAt` timestamp

---

## Adapter (`adapter.ts`)

Bridges the new `BotDefinition` system with the existing SaaS `Nanobot` interface used by the orchestrator.

```typescript
const nanobot = adaptToNanobot(botDefinition);
// Returns a Nanobot with a run() method that uses executeBot() internally
```

The adapter:
- Uses `@ai-sdk/anthropic` (Claude Sonnet) for SaaS execution
- Merges context system prompts with bot system prompts
- Builds PR titles and bodies from findings
- Handles both scan bots (findings) and doc bots (fixedContent)

---

## Local Store (`cli/bots/local-store.ts`)

Filesystem-based bot storage for the CLI. Bots are stored as `.nanobots/bots/<name>.json`.

```typescript
await saveBot(bot, rootDir);         // Write to .nanobots/bots/<name>.json
const bot = await loadBot(name, rootDir);  // Read single bot
const bots = await loadLocalBots(rootDir); // Read all local bots
await deleteBot(name, rootDir);            // Delete bot file
```

---

## CLI Commands

### `nanobots create "<description>"`

Creates a new bot using AI. Requires `OPENROUTER_API_KEY`. Saves to `.nanobots/bots/`.

### `nanobots test <bot-name> [dir]`

Tests a bot against local files. Shows findings with severity-colored output. Loads from local store first, then falls back to registry.

### `nanobots promote <bot-name>`

Promotes a bot to the next lifecycle stage: `draft -> testing -> active`. Updates the local JSON file.

### `nanobots list [--all]`

Lists bots with status icons. Without `--all`, shows only active bots. With `--all`, shows all statuses. Custom user bots marked with `(custom)`.

### `nanobots describe <bot-name>`

Shows full bot details: name, description, category, status, source, file extensions, tools count, system prompt preview.

### `nanobots scan [dir]`

Runs active bots against a directory. Supports `--bot <name>` to run a specific bot, `--bots <category>` to filter by category, `--fix` to write fixes, `--json` for CI output.

---

## SaaS Chat Tools

Three new chat tools added for bot management through the SaaS chat interface:

### `createBot`

Creates a bot from a description. Uses `generateText()` with `@ai-sdk/anthropic` for design, saves to DB via `upsertSystemPrompt()`.

Parameters: `name` (optional), `description` (required), `category` (optional)

### `testBot`

Tests a bot against a GitHub repository. Fetches files via Octokit, runs through the shared engine.

Parameters: `botName` (required), `repo` (optional, defaults to org's first repo)

### `promoteBot`

Promotes a bot to the next lifecycle stage. Logs activity.

Parameters: `botName` (required)

---

## Prompt Refiner (`prompt-refiner.ts`)

Background system that evolves bot prompts over time. Uses the AI SDK to analyze findings and refine system prompts for better accuracy.

The `PromptRefiner` class:
1. Analyzes recent findings from a bot
2. Identifies patterns (false positives, missed issues)
3. Generates a refined system prompt
4. Returns the update for review/application

---

## Testing

### Unit Tests (90 tests, ~300ms)

| File | Tests | Coverage |
|------|-------|----------|
| `types.test.ts` | 7 | Type interface validation |
| `defaults.test.ts` | 14 | Built-in bot validation, system prompt content |
| `registry.test.ts` | 17 | CRUD, filtering, merge, override behavior |
| `lifecycle.test.ts` | 16 | Promotion, archival, canPromote rules |
| `tool-library.test.ts` | 12 | All 4 handlers, schema generation, errors |
| `engine.test.ts` | 9 | Mock generateText, batching, parsing |
| `bot-creator.test.ts` | 6 | LLM response parsing, defaults, safety |
| `local-store.test.ts` | 9 | Filesystem CRUD with temp directories |

### CLI E2E Tests (24 tests, ~40s)

- `cli-list.test.ts` (11 tests): list, describe, help, version, unknown command
- `cli-lifecycle.test.ts` (13 tests): create/test/promote lifecycle with temp directory

### Browser E2E Tests (18 tests, skipped by default)

- `browser-saas.test.ts`: Landing page, auth flow, chat interface, tool interactions, responsive layout
- Requires `RUN_BROWSER_TESTS=true` and Chrome DevTools MCP

---

## Data Flow

### CLI Scan

```
User -> cli/index.ts -> scanCommand()
  -> loadLocalBots() -> createRegistry(userBots)
  -> registry.getActive() (or filter by --bot/--bots)
  -> walkFiles(dir)
  -> For each bot:
       -> executeBot(bot, files, model)
            -> filterByExtensions()
            -> batchFiles()
            -> generateText() per batch
            -> parseFindings()
       -> merge findings
  -> outputFindings() (human or JSON)
```

### SaaS Chat

```
User message -> /api/chat route -> streamText()
  -> LLM decides to call createBot/testBot/promoteBot tool
  -> Tool handler:
       createBot: createBotFromDescription() + DB save
       testBot: loadBot() + executeBot() + return findings
       promoteBot: promoteBot() + DB update
  -> Response streamed back to chat UI
```

### Bot Creation

```
User: "Create a bot that finds TODO comments"
  -> createCommand() [CLI] or createBot tool [SaaS]
  -> createBotFromDescription(description, model)
       -> generateText() with meta-prompt
       -> Parse JSON response -> BotDefinition
       -> Force status: "draft", source: "user"
  -> saveBot() [CLI: filesystem] or upsertSystemPrompt() [SaaS: DB]
```

---

## Migration Notes

### What Changed from the Original Bot System

1. **6 individual bot files deleted** (`cli/bots/security-scanner.ts`, etc.) -> Replaced by `defaults.ts` containing all 6 as data.

2. **CLI bots module** (`cli/bots/types.ts`, `cli/bots/index.ts`) -> Now re-exports from shared core with backward-compatible wrappers.

3. **CLI analyzer** (`cli/analyzer.ts`) -> Rewritten to use `executeBot()` from shared engine instead of duplicated AI call logic.

4. **CLI prompt-refiner** (`cli/prompt-refiner.ts`) -> Replaced with re-export from shared `ai-bots/prompt-refiner.ts`.

5. **New dependency**: `@ai-sdk/openai` added for CLI's OpenRouter access via AI SDK.

6. **DB schema**: Added `BotMetadata` interface for the JSONB metadata column on `system_prompts` table.
