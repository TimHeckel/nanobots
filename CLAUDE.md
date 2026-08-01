# nanobots-sh — project guide

**What this repo is.** `nanobots-sh` is a **zero-dependency npm CLI that installs a
self-improving agent loop onto _any other_ GitHub repo.** It is not an app or a library
you import — its whole job is to scaffold a target repo and then get out of the way. After
`npx nanobots-sh init`, the target repo is fully self-contained (markdown prompts + one
shell script + plain GitHub workflows) with **no runtime dependency back on this package.**

> This repo has one prior life as an AI-SDK chatbot. That is gone. Ignore any lingering
> references to `useChat`, `src/lib/`, OpenRouter provider factories, Vitest suites, etc. —
> none of it exists here anymore. This file is the source of truth for the current vision.

## The product (what gets installed)

Two loops, with **GitHub as the only state store** — issues are intake, a Projects v2
board is the kanban, PRs are the audit trail, a pinned issue is the heartbeat:

- **Outer loop** (stateless, runtime-agnostic): ingest → triage → prioritize → dispatch →
  review outcomes → **learn** (it rewrites its own rubric/recipes/instructions over time;
  the policy docs are its weights, GitHub history is its training log).
- **Nanobot workers** (inner loop): claim a card → build **inside a disposable Daytona
  sandbox** (never on a laptop/CI runner) → open a PR with `Closes #N`.
- **Required OCR review**: every `nanobots:built` PR gets a bounded
  [Open Code Review](https://github.com/alibaba/open-code-review) pass; critical/high
  findings block merge. Optional **surgical autofix responder** proposes exact,
  mechanically-validated text edits (never free-form patches) inside its own Daytona
  sandbox.

## Repo layout

- `src/cli.mjs` — the **entire CLI** (zero deps, Node ≥18 built-ins only). `bin: nanobots`.
- `templates/` — everything rendered into a target repo:
  - `templates/nanobots/*` — prompts (LOOP/WORKER/EXTENSION), rubric (TRIAGE), RECIPES,
    LEARNINGS, RUNTIMES, `run-cycle.sh`, the Daytona client/worker + OCR autofix libs.
  - `templates/github/*` — Actions workflows (outer/worker/ocr) + issue intake forms.
- `extension/` — zero-dependency MV3 Chrome extension for signal capture (files a
  `nanobots:inbox` issue). `dist/*.zip` are its packaged releases.
- `tests/` — plain `node:test`-style files run by `npm test` (render + ocr-autofix). They
  test the library/render logic directly, **not** the CLI entry.
- `install.sh` — thin `curl | sh` bootstrap: checks prereqs, then `npx nanobots-sh init`.
- `docs/` — architecture + research notes. `site/` — the nanobots.sh landing page.

## CLI commands (`src/cli.mjs`)

- `init` — **AI onboarding agent, the only install path.** Requires an OpenAI-compatible
  endpoint via env (`OCR_LLM_URL` / `OCR_LLM_TOKEN` / `OCR_LLM_MODEL` — the same provider
  the required OCR review uses). The agent runs a tool-calling loop over that endpoint and
  drives the whole setup: gathers config → renders the scaffold → scaffolds GitHub state →
  collects & sets secrets/variables via `gh` → verifies Daytona (live create/delete proof
  before storing the key) → explains the one manual board setting. Hidden `--headless` flag
  scaffolds from defaults with no agent (CI / self-tests only; keep it out of docs/help).
- `update` — re-render **engine-owned** files only; never touches repo-owned files
  (`TRIAGE.md`, `RECIPES.md`, `LEARNINGS.md`, `config.json`). Engine-owned files carry a
  `nanobots:engine-owned` marker.
- `run <outer|worker>` — one headless cycle via the installed `.nanobots/run-cycle.sh`.
- `verify daytona` — connection + sandbox lifecycle proof (shares `daytonaProof()` with the
  onboarding agent).
- `extension` — copy the browser extension locally + print Chrome load steps.

## Conventions

- **Zero dependencies, ever.** `src/cli.mjs` uses only Node built-ins (`node:child_process`,
  `node:fs`, `node:readline`, `fetch`). Do not add an npm dependency to the CLI.
- **Engine-owned vs repo-owned** is the core distinction in `cli.mjs`
  (`ENGINE_OWNED` / `CONDITIONAL_ENGINE_OWNED` / `REPO_OWNED`). Respect it: `update` must
  never clobber a repo's own drifted loop docs.
- **CLI output**: human/progress text via `say`/`warn`/`die`; the onboarding agent speaks
  to the user **only** through its `message_user` / `ask_user` tools.
- **Billing is an env var, not a feature.** `CLAUDE_CODE_OAUTH_TOKEN` (subscription) or
  `ANTHROPIC_API_KEY` (metered), or any Anthropic-compatible base URL. Workers and the outer
  loop can use different models.
- **Secrets never enter argv.** Set them via `gh secret set NAME` with the value on stdin;
  variables (non-sensitive) may use `--body`.
- **Bump `package.json` version** on any user-facing change; the git history uses
  `type: subject (x.y.z)` commit subjects.

## Requirements for the installed loop

`gh` authenticated with
the `project` scope; a Daytona account + `DAYTONA_API_KEY`
(required — there is no local worker mode); a **classic** `PROJECTS_PAT` (project + repo + read:org,
human account — the default `GITHUB_TOKEN` cannot touch org Projects v2); and the OCR
inference endpoint (`OCR_LLM_*`).
