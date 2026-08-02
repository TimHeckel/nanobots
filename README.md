# nanobots

**A self-improving agent loop you install onto any GitHub repo.** Issues come in, an outer
loop triages and prioritizes them, workers build them inside disposable sandboxes, every PR
gets an independent review, and the loop rewrites its own policy from what happened.

```bash
cd your-repo
export OCR_LLM_URL=https://api.deepseek.com/chat/completions
export OCR_LLM_TOKEN=sk-...
export OCR_LLM_MODEL=deepseek-v4-flash
npx nanobots-sh init
```

`init` is a conversation, not a flag soup. It reads your repo, asks a handful of questions,
scaffolds the board, creates a GitHub App, sets your secrets, proves your sandbox works, and
tells you the one thing GitHub's API can't do for you.

Inspired by [Autoresearch/Introspection](https://www.latent.space/p/autoresearch-introspection):
the durable product isn't the code, it's the loop that maintains it.

---

## The opinions

Most of this project is a small number of choices held firmly. If you disagree with these,
you'll fight the tool.

**GitHub is the only state store.** Issues are intake. A Projects v2 board is the kanban. PRs
are the audit trail. A pinned issue is the heartbeat. There is no database, no dashboard, no
account. If the loop's state isn't visible on GitHub it doesn't exist — which means you can
always see what it did and why, and you can always override it by hand.

**Workers never run on your machine.** Every worker builds inside a disposable
[Daytona](https://daytona.io) sandbox, destroyed when the run ends. Not a launcher option —
the only worker runtime. Arbitrary build and test commands written by an agent should not
touch your laptop or your CI runner.

**The sandbox gets a credential that can't do much.** With a GitHub App configured, the
controller mints a short-lived, repository-scoped installation token per run and revokes it
afterwards. It grants `contents: write` and deliberately **not** `pull_requests`. A sandbox
that outlives its run can push to a branch nobody is watching, and that is the entire blast
radius — it cannot open, modify, or merge a PR, and it never sees the App's private key. The
controller opens the PR, because the sandbox structurally can't.

**Review is not optional.** Every `nanobots:built` PR gets an
[Open Code Review](https://github.com/alibaba/open-code-review) pass on that exact head SHA.
Critical and high findings block merge. Isolated execution without an independent review of
the result is only half the safety story. A failed or unparseable review is never treated as
clean — it blocks.

**Humans are a gate, not a bottleneck.** Nothing gets built until a collaborator replies
`/nanobots start <hash>` to a versioned plan. Hard-gate areas are triaged but never
auto-dispatched. When the bots are out of their depth they `summon-human` and stop.

**The loop edits its own policy.** Every finished or failed item gets a `LEARNINGS.md` entry.
Every ~10 entries it distills them into the triage rubric, the recipes, and your agent
instructions file — and commits that. The policy documents are its weights; GitHub history is
the training log. Your rubric is *supposed* to drift from the template.

**Billing is an env var, not a feature.** `CLAUDE_CODE_OAUTH_TOKEN` runs on a Claude
subscription; `ANTHROPIC_API_KEY` is metered; `NANOBOTS_WORKER_CMD` swaps the engine entirely
for Codex, OpenHands, aider, or a local server. Cheap models for labour and a frontier model
for judgment, if you like.

---

## How it runs

```
signals ──▶  OUTER LOOP        ingest → triage → prioritize → dispatch
             (anywhere)        → review outcomes → LEARN
                  │                        ▲
          dispatch│                        │ outcomes (PRs, CI, OCR)
                  ▼                        │
             WORKERS           claim → Daytona sandbox → build → gates
             (always Daytona)  → push → controller opens PR
```

The **outer loop** never writes product code, so it runs anywhere: `/loop` in Claude Code, a
cron on your own box, or the installed GitHub Actions workflow. The **worker** always runs in
Daytona regardless of what triggered it.

```bash
npx nanobots-sh run outer     # one triage/review/learn cycle
npx nanobots-sh run worker    # claim one approved item, build it in a sandbox
```

Set `NANOBOTS_OUTER_ENABLED=1` and `NANOBOTS_WORKER_ENABLED=1` when you want the installed
crons to take over. Leave them off until you've watched a cycle by hand.

## Requirements

- **`gh`** authenticated with `project` scope (`gh auth refresh -s project`)
- **A [Daytona](https://daytona.io) API key** — required; there is no local worker mode
- **`PROJECTS_PAT`** — a *classic* PAT with `repo` + `project` + `read:org`, from a human
  account. The default `GITHUB_TOKEN` cannot touch org Projects v2 at all, and `gh project`
  needs `read:org` even for a personal account
- **An OpenAI-compatible endpoint** (`OCR_LLM_URL` / `_TOKEN` / `_MODEL`) — powers both the
  onboarding agent and the required review, so it isn't an extra key
- **A model credential** for the loop and workers — `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY`
- Recommended: **a GitHub App** for per-run sandbox credentials. `nanobots app create` builds
  and installs it for you with the correct permission set

## Commands

```bash
npx nanobots-sh init                 # AI onboarding agent (needs OCR_LLM_URL/TOKEN/MODEL)
npx nanobots-sh update               # re-render engine-owned files only
npx nanobots-sh run <outer|worker>   # one headless cycle (worker = Daytona sandbox)
npx nanobots-sh app create           # create + install the per-run credential GitHub App
npx nanobots-sh app install <slug>   # finish an interrupted app setup
npx nanobots-sh verify daytona       # connection + exec proof, before enabling the worker cron
npx nanobots-sh extension            # copy the browser extension here (+ load steps)
npx nanobots-sh version
```

`update` re-renders **engine-owned** files only. `TRIAGE.md`, `RECIPES.md`, `LEARNINGS.md`,
and `config.json` belong to your repo and are never touched — that drift is the point.

## Browser extension

[`extension/`](extension/) captures signal from any page: click → screenshot → annotate in
place (pen, box, arrow, text; drag, resize, rotate) → filed as a `nanobots:inbox` issue the
board picks up. Screenshots go to your own Cloudflare R2 bucket, so your repo stays free of
binaries. It also has a repo-aware agent chat that searches your code and issues, reads
screenshots you paste, and files for you — bring your own model, with a separate vision model
if you want one.

Its prompt lives in `.nanobots/EXTENSION-PROMPT.md` and the outer loop refines it based on how
extension-filed reports fare in triage. The intake improves itself too.

```bash
npx nanobots-sh extension    # then chrome://extensions → Developer mode → Load unpacked
```

## Stacked PRs

Off by default (`stacks.enabled`). When on, nanobots uses
[GitHub's native stacked PRs](https://github.blog/changelog/2026-07-30-stacked-pull-requests-are-now-in-public-preview/)
via `gh-stack` rather than building its own. The outer loop owns stack topology; workers stay
unaware. The rule that makes it safe: merging a lower layer auto-rebases everything above it,
silently changing their head SHAs — and review is bound to the exact SHA, so any mismatch is
treated as unreviewed and re-dispatched. Restack conflicts escalate to a human; an agent is
never allowed to resolve one.

## Docs

- [docs/architecture.md](docs/architecture.md) — the two loops, the GitHub surface mapping, design decisions
- [docs/e2e-harness.md](docs/e2e-harness.md) — the test tiers, and what dogfooding this on itself actually broke
- `.nanobots/RUNTIMES.md` after install — the security model, credential placement, and the honest limits

## License

MIT
