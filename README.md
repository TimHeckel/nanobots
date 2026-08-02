# nanobots

**Self-improving agent loops for any GitHub repo.** An outer loop triages, prioritizes,
dispatches, reviews, and *learns*; nanobot workers claim cards and build in a disposable
[Daytona](https://daytona.io) sandbox, then ship PRs. GitHub is the only state store —
issues are the intake, a Projects v2 board is the kanban, PRs are the audit trail, and a
pinned issue is the heartbeat. When the bots are out of their depth, they `summon-human`.

Inspired by [Autoresearch/Introspection](https://www.latent.space/p/autoresearch-introspection):
the durable product isn't the code, it's the loop that maintains it — with humans as a
deliberate signal source, not a bottleneck.

```
                 ┌────────────────────────────────────────────────┐
   signals ───▶  │  OUTER LOOP (control + learning)               │
   issues,       │  ingest → triage → prioritize → dispatch       │
   errors,       │  → review outcomes → LEARN (update its policy) │
   humans        └───────────────┬────────────────▲───────────────┘
                                 │ dispatch        │ outcomes (PRs, CI)
                                 ▼                 │
                 ┌────────────────────────────────┴───────────────┐
                 │  NANOBOT WORKERS (inner loop)                  │
                 │  claim card → branch → build → tests →         │
                 │  PR (Closes #N) → gates → merged by outer loop │
                 └────────────────────────────────────────────────┘
```

## Install (any repo)

Install is an **AI onboarding agent** — the only way in. Give it an OpenAI-compatible
inference endpoint first (the *same* provider your repo needs for the required OCR review,
so it's not an extra key), then run `init`:

```bash
cd your-repo
export OCR_LLM_URL=https://api.deepseek.com/chat/completions
export OCR_LLM_TOKEN=sk-...            # your provider key
export OCR_LLM_MODEL=deepseek-v4-flash
npx nanobots-sh init                  # or: curl -fsSL nanobots.sh/install | sh
```

The agent then drives the whole setup conversationally — no checklist to work through
afterward. It:

1. auto-detects your repo (owner/branch/test commands), asks a handful of config
   questions, and **renders the loop** into `.nanobots/` (prompts, triage rubric, recipes,
   learnings log, runner script, the Daytona worker controller, `config.json`) plus GitHub
   workflows + issue intake forms,
2. **scaffolds GitHub state** via `gh`: the project board, Status/Priority/Size fields,
   labels, and a pinned status issue,
3. **collects and sets your secrets and variables for you** — the model credential,
   `PROJECTS_PAT`, `DAYTONA_API_KEY` (verified with a live create/delete sandbox proof
   *before* it's stored), and the OCR review config — explaining what each one is and how
   to get it, and offering the optional autofix responder,
4. walks you through the one board setting GitHub's API can't script (the "Auto-add to
   project" workflow).

After `init` the repo is **fully self-contained** — markdown prompts, one shell script,
plain workflows. No runtime dependency on this package. Your repo's rubric and recipes
are *supposed* to drift from the templates: that's the learning.

> The onboarding agent runs on any OpenAI-compatible `/chat/completions` endpoint with
> tool-calling (DeepSeek, OpenAI, Together, OpenRouter, a local server, …). It talks to
> you and sets things via `gh` on your machine — it never sees more than you type.

## Run it

The **outer loop** is stateless and runtime-agnostic — it never touches product code, so
run it wherever's convenient:

| Where | How |
|---|---|
| Laptop (interactive) | `/loop` in Claude Code with `.nanobots/LOOP-PROMPT.md` |
| VM / your own box | `npx nanobots run outer` (or `bash .nanobots/run-cycle.sh outer`) on a systemd/launchd timer |
| GitHub Actions | the installed `nanobots-outer.yml` cron (set `NANOBOTS_OUTER_ENABLED=1`) |

The **worker** always builds inside a disposable [Daytona](https://daytona.io) sandbox —
that's not a runtime choice, it's how nanobots keeps write credentials and arbitrary
build/test commands off your laptop and CI runners. `npx nanobots run worker` (from a
laptop, a VM cron, or the installed `nanobots-worker.yml` Actions cron — the trigger
location doesn't matter) claims the next approved item, provisions the sandbox, builds,
opens the PR, and deletes the sandbox when it's done. Run `npx nanobots-sh verify daytona`
once you've set `DAYTONA_API_KEY`, before turning the worker cron on. See
`.nanobots/RUNTIMES.md` after install for the full contract and security model.

**Billing is an env var, not a feature.** `CLAUDE_CODE_OAUTH_TOKEN` runs everything on a
Claude Pro/Max **subscription** (mint once: `claude setup-token`). `ANTHROPIC_API_KEY` is
metered. Any Anthropic-compatible provider works — e.g. DeepSeek via
`ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic`. Mix per runtime: cheap model
workers, frontier model for the outer loop's judgment.

**Workers are swappable inside the sandbox.** Claude Code is the shipped implementation;
a worker is anything that reads an issue's work-spec and opens a PR with `Closes #N`, so
Copilot's coding agent, Codex, or OpenHands can run inside the same sandbox contract.

**Every PR gets an OCR review — required, not optional.** `nanobots:built` PRs get a
bounded [Open Code Review](https://github.com/alibaba/open-code-review) pass on the exact
PR head, run as a normal Actions job — not inside Daytona, since it only reads a diff and
calls an LLM. It submits a real GitHub review (inline comments + approve/request-changes)
and writes a fingerprinted, machine-readable report. Critical/high findings block merge
until addressed or a human overrides. Isolated execution without an independent review of
the result is only half the safety story; this is the other half.

**Optional: a surgical autofix responder.** Set `OCR_AUTOFIX_ENABLED=true` and eligible
PRs (same-repo, non-draft, `nanobots:built`) get their blocking findings evaluated by a
second model that proposes exact, atomic text replacements — never free-form patches or
shell commands — validated mechanically (unique match in the real file, inside what the
model was actually shown, no overlaps) before anything touches a file. The fix runs inside
its own disposable Daytona sandbox, same as the worker; if your gates pass and the PR head
hasn't moved, it pushes one repair commit, resolves the threads it fixed, and triggers a
fresh OCR round — capped at 3 rounds per PR by default. Anything the model isn't sure
about, or that touches a protected path (`.github/**`, `.nanobots/**`, lockfiles, auth,
migrations, infra), comes back `needs_human` instead of a patch. Reviewer and fixer models
are configured independently — DeepSeek V4 Flash is the shared default for both if you
don't override either.

**Workers get a per-run credential, not your PAT.** Configure a GitHub App
(`NANOBOTS_GITHUB_APP_ID` / `_INSTALLATION_ID` / `_PRIVATE_KEY`, offered during `init`) and the
controller mints a **short-lived, repository-scoped installation token per run**, hands only
that to the sandbox, and revokes it on the way out. It grants `contents: write` + `metadata:
read` and deliberately **omits `pull_requests`** — so a sandbox that outlives its run can push
to a branch nobody is watching, and that is the entire blast radius: it cannot open, modify, or
merge a PR, or mint another credential. The App private key never enters the sandbox. Two
honest limits: `contents: write` is repository-wide rather than ref-scoped (branch protection,
not token scope, is what contains a stray push), and revocation is eventually consistent
(~2–7s observed). Without an App, the PAT remains a documented fallback.

**Stacked PRs, off by default.** A loop that triages into small items produces dependent ones.
nanobots supports [GitHub's native stacked PRs](https://github.blog/changelog/2026-07-30-stacked-pull-requests-are-now-in-public-preview/)
(public preview) via `gh-stack` rather than building its own — set `stacks.enabled` in
`config.json`. The outer loop owns stack topology; workers stay unaware. The rule that makes it
safe: when a lower layer merges, GitHub auto-rebases every PR above it, silently changing their
head SHAs — and OCR reviews *the exact head SHA*, so the loop treats any SHA mismatch as
unreviewed and re-dispatches OCR before merge. Restack conflicts escalate to a human; an agent
is never allowed to resolve one.

## How the learning works

Every finished (or failed) work item gets an entry in `.nanobots/LEARNINGS.md` — an
append-only memory. Every ~10 entries the outer loop runs a distill pass, promoting
durable lessons into the triage rubric, the recipes, and your agent instructions file.
The loop's policy documents are its weights; GitHub history is the training log.

## Requirements

- `gh` CLI authenticated, with the `project` scope (`gh auth refresh -s project`)
- A [Daytona](https://daytona.io) account and API key — required, not optional. Workers
  always build in a Daytona sandbox; there's no local/VM worker mode.
- Secrets: `CLAUDE_CODE_OAUTH_TOKEN` (or another model credential), `PROJECTS_PAT` — a
  **classic** PAT (`project` + `repo` + `read:org`) from a **human** account (the default `GITHUB_TOKEN`
  cannot touch org Projects v2 at all), `DAYTONA_API_KEY`, and an OpenAI-compatible
  inference endpoint/key for OCR: `OCR_LLM_URL` / `OCR_LLM_TOKEN` / `OCR_LLM_MODEL`.
- Optional, but recommended: `NANOBOTS_GITHUB_APP_ID`, `NANOBOTS_GITHUB_APP_INSTALLATION_ID`,
  and `NANOBOTS_GITHUB_APP_PRIVATE_KEY` — configure all three together (a partial setup is
  treated as unconfigured and falls back to the PAT) to mint short-lived, repo-scoped
  installation tokens per worker run instead of sharing the long-lived, org-wide PAT.
- Optional, only for the autofix responder: `OCR_AUTOFIX_ENABLED=true` plus
  `OCR_AUTOFIX_MODEL` / `OCR_AUTOFIX_URL` / `OCR_AUTOFIX_TOKEN` (each falls back to the
  matching `OCR_LLM_*` reviewer setting, so a one-provider setup needs nothing extra).

## Commands

```bash
npx nanobots-sh init                                    # AI onboarding agent (needs OCR_LLM_URL/TOKEN/MODEL)
npx nanobots-sh update                                  # re-render engine-owned files only
npx nanobots-sh run <outer|worker>                      # one headless cycle (worker = Daytona sandbox)
npx nanobots-sh verify daytona                           # connection + lifecycle proof
```

`update` never touches repo-owned files (TRIAGE.md, RECIPES.md, LEARNINGS.md,
config.json) — those belong to your repo's loop. Engine-owned files carry a
`nanobots:engine-owned` marker in their first lines.

## Browser extension (signal capture)

[`extension/`](extension/) is a zero-dependency MV3 Chrome extension that feeds the loop
from any webpage: click → screenshot → annotate (pen/box/arrow) → filed as a
`nanobots:inbox` issue the board auto-adds for triage. Screenshots live in your
Cloudflare R2 bucket (free tier; the issue embeds the link, git stays binary-free) —
capture is disabled until R2 is connected, and the options page walks through the
3-minute free setup. It keeps a local **history** of
everything you've filed (with live state), and has a **repo chat** — a BYO-model agent
with real repo tools (code/issue search, file read, report filing with your pasted
screenshots). The chat agent's prompt lives in the repo (`.nanobots/EXTENSION-PROMPT.md`)
and is refined by the outer loop based on how extension-filed reports fare in triage —
the intake itself self-improves. Install: `chrome://extensions` → Developer mode → Load
unpacked → `extension/`. See [extension/README.md](extension/README.md).

## Docs

- [docs/architecture.md](docs/architecture.md) — the two loops, the GitHub surface mapping,
  the cycle spec, design decisions
- [docs/research/](docs/research/) — the July 2026 tooling landscape + the GitHub Projects v2
  automation reference this design is built on

## License

MIT
