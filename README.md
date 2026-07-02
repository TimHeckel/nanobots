# nanobots

**Self-improving agent loops for any GitHub repo.** An outer loop triages, prioritizes,
dispatches, reviews, and *learns*; nanobot workers claim cards and ship PRs. GitHub is the
only state store — issues are the intake, a Projects v2 board is the kanban, PRs are the
audit trail, and a pinned issue is the heartbeat. When the bots are out of their depth,
they `summon-human`.

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

```bash
cd your-repo
npx nanobots-sh init        # or: curl -fsSL nanobots.sh/install | sh
```

`init` asks ~6 questions (test commands, hard-gate areas, WIP cap — with answers
auto-detected from your repo where possible; **no model/API key needed to install**),
then:

1. renders the loop into `.nanobots/` (prompts, triage rubric, recipes, learnings log,
   runner script, `config.json`),
2. writes GitHub workflows + issue intake forms,
3. scaffolds GitHub state via `gh`: the project board, Priority/Size fields, labels,
   and a pinned status issue,
4. prints the two manual steps GitHub's API can't do, plus the secrets checklist.

After `init` the repo is **fully self-contained** — markdown prompts, one shell script,
plain workflows. No runtime dependency on this package. Your repo's rubric and recipes
are *supposed* to drift from the templates: that's the learning.

Optional: `init --smart` additionally uses the `claude` CLI (if installed) to study your
repo and draft repo-specific recipes and gates into `.nanobots/SUGGESTIONS.md`.

## Run it

The loop is stateless: "running" = something executes one cycle on a cadence. Run either
role anywhere — see `.nanobots/RUNTIMES.md` after install.

| Where | How |
|---|---|
| Laptop (interactive) | `/loop` in Claude Code with `.nanobots/LOOP-PROMPT.md` (outer) or `WORKER-PROMPT.md` |
| VM / your own box | `npx nanobots run outer` (or `bash .nanobots/run-cycle.sh outer`) on a systemd/launchd timer |
| GitHub Actions | the installed `nanobots-outer.yml` cron (set `NANOBOTS_OUTER_ENABLED=1`) |
| Sandbox cloud (Daytona/E2B/…) | same script + two env vars; a ~20-line launcher when you need per-item isolation |

**Billing is an env var, not a feature.** `CLAUDE_CODE_OAUTH_TOKEN` runs everything on a
Claude Pro/Max **subscription** (mint once: `claude setup-token`). `ANTHROPIC_API_KEY` is
metered. Any Anthropic-compatible provider works — e.g. DeepSeek via
`ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic`. Mix per runtime: cheap model
workers on a VM, frontier model for the outer loop's judgment.

**Workers are swappable at the PR seam.** A worker is anything that reads an issue's
work-spec and opens a PR with `Closes #N` — Claude Code (ours), GitHub Copilot's coding
agent (assign the issue), Codex, OpenHands. The board can't tell the difference.

## How the learning works

Every finished (or failed) work item gets an entry in `.nanobots/LEARNINGS.md` — an
append-only memory. Every ~10 entries the outer loop runs a distill pass, promoting
durable lessons into the triage rubric, the recipes, and your agent instructions file.
The loop's policy documents are its weights; GitHub history is the training log.

## Requirements

- `gh` CLI authenticated, with the `project` scope (`gh auth refresh -s project`)
- The [Claude GitHub App](https://github.com/apps/claude) on the repo (`claude /install-github-app`)
  — only needed for the Actions execution paths
- Two secrets for Actions mode: `CLAUDE_CODE_OAUTH_TOKEN`, and `PROJECTS_PAT` — a
  **classic** PAT (`project` + `repo`) from a **human** account. Two hard-won facts baked
  into the design: the default `GITHUB_TOKEN` cannot touch org Projects v2 at all, and
  claude-code-action refuses runs initiated by bot actors, so dispatch comments must post
  as a human.

## Commands

```bash
npx nanobots-sh init [--smart] [--no-github] [--yes]   # scaffold a repo
npx nanobots-sh update                                  # re-render engine-owned files only
npx nanobots-sh run <outer|worker>                      # one headless cycle
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
