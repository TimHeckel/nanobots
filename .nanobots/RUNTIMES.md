<!-- nanobots:engine-owned v0.2 — re-rendered by `nanobots update`; put repo policy in TRIAGE.md/RECIPES.md/config.json instead -->
# Runtimes — outer loop anywhere, worker always in Daytona

Design stance: **one adapter, not a matrix.** The outer loop never touches product code, so
it stays a "run the same one-shot process with two credentials" contract and can run
anywhere. The worker touches product code — writes files, runs arbitrary project commands,
pushes branches — so it always runs inside a disposable [Daytona](https://daytona.io)
sandbox. That's not a launcher option among several; it's the only worker runtime nanobots
supports. Trading "runs anywhere" for "runs isolated, every time" is the deliberate
tradeoff: no laptop or CI runner ever holds your repo's write credentials for longer than
one sandboxed run, and a runaway build/test command can't touch anything outside the box.

## Outer loop contract (unchanged, runs anywhere)

A process that:

1. has the repo checked out (or clones it),
2. has `GH_TOKEN` — classic PAT, scopes `project` + `repo` + `read:org` (must belong to a **human**
   account: claude-code-action refuses bot actors on dispatch),
3. has ONE model credential (`CLAUDE_CODE_OAUTH_TOKEN`, `ANTHROPIC_API_KEY`, or
   `ANTHROPIC_AUTH_TOKEN` + `_BASE_URL` + `_MODEL` — see "Swapping the brain"),
4. runs `.nanobots/LOOP-PROMPT.md` for **one cycle** and exits.

**In GitHub Actions, `claude-code-action` needs a GitHub credential passed as its
`github_token` INPUT** — not as a `GH_TOKEN` env var. With no input token it falls back to
requiring the [Claude Code GitHub App](https://github.com/apps/claude) and fails every run
with "Claude Code is not installed on this repository", which reads like a missing
prerequisite but is really a wiring mistake. `nanobots-outer.yml` passes `PROJECTS_PAT` as
that input, so the App is **not** required. Installing the App instead is a valid
alternative. Laptop and VM runs are unaffected — they invoke the CLI directly.

| Where | How |
|---|---|
| Laptop (interactive) | `/loop` in Claude Code with `.nanobots/LOOP-PROMPT.md` |
| VM / your own box | `.nanobots/run-cycle.sh outer` on a systemd/launchd timer |
| GitHub Actions | the installed `nanobots-outer.yml` cron |

Recommended cadence: every 20-30 min. A cycle with nothing to triage or review is cheap —
it reads the board and exits.

## Worker contract (always Daytona)

`.nanobots/run-cycle.sh worker` (or `npx nanobots-sh run worker`) no longer executes the
worker locally. It runs `.nanobots/daytona-worker.mjs`, which:

1. reads `.nanobots/config.json` for the Daytona snapshot/target and the plan-approval
   policy;
2. finds the top **Ready** item that is not `summon-human` and, if
   `approval.requireVersionedStart` is on (the default), has an unexpired
   `/nanobots start <plan-hash>` approval from a collaborator matching the current plan
   comment — see the Dispatch step in `.nanobots/LOOP-PROMPT.md`;
3. claims it (move to In Progress, comment with the run ID) and re-reads to confirm no one
   else's claim beat it;
4. creates a Daytona sandbox from snapshot `provider default` in target
   `us`, labeled `nanobots-TimHeckel-nanobots-<issue>-<attempt>`;
5. clones the repo into it and runs `.nanobots/WORKER-PROMPT.md` headless inside the
   sandbox (same `claude -p` invocation `run-cycle.sh` used to run locally — it just runs
   there now);
6. the sandboxed agent commits, pushes, and opens the PR itself (see "Security model"
   below for why, and what that costs);
7. deletes the sandbox in a `finally` block — always, success or failure. A run that dies
   mid-cycle leaves no sandbox behind; the claim is visible on the board for the outer
   loop's stall check to recycle if nothing else happened.

You can invoke `run worker` from a laptop, a VM timer, or a scheduled Actions job — the
*trigger* location doesn't matter anymore, because the actual work always happens inside
the sandbox, not on the machine that dispatched it. Pick whichever trigger location is
convenient; `npx nanobots-sh run worker` on a cron (systemd, launchd, or an Actions
workflow you add yourself) all work identically.

## Security model

Daytona buys isolation for the *build*, not zero-trust GitHub publication. Being upfront
about the shape of the tradeoff:

**Controller-side, never enters the sandbox:**
- `DAYTONA_API_KEY` — used only to create/exec/delete the sandbox from the triggering
  process.
- The model credential, unless you're running a subscription token that's fine to scope
  per-run (see below).

**Sandbox-side, for the duration of one run only:**
- `GH_TOKEN` — either a **per-run GitHub App installation token** (recommended; see below)
  or, when no App is configured, the same classic PAT the outer loop uses. The App path is
  strictly better and is what you should run.
- The model credential (whichever one the triggering process was given).
- Nothing else. No production database URL, no cloud credentials, no other repo's secrets.
  In particular **not** the App private key — see below.

## GitHub App credentials (recommended)

Without an App, the sandbox holds a long-lived, org-wide PAT that **carries pull-request
permission**. That matters more than it sounds: for a system whose safety story is "the outer
loop reviews and merges", a sandbox credential that can open, update, and merge PRs makes the
outer loop advisory rather than authoritative. It also can't be revoked per run — cleanup
means rotating a shared secret, which breaks every other run.

Set all three of `NANOBOTS_GITHUB_APP_ID`, `NANOBOTS_GITHUB_APP_INSTALLATION_ID`, and
`NANOBOTS_GITHUB_APP_PRIVATE_KEY` and the controller mints a **short-lived, repository-scoped
installation token per run** instead, hands only that to the sandbox, and revokes it on the
way out. A partially configured App is treated as *unconfigured* (with a loud warning) so a
half-finished setup can't half-enable the path.

**Setup.** Register a GitHub App (org or personal), then install it on **selected
repositories** — this repo — rather than "all repositories". Grant exactly:

| Grant | Value | Why |
|---|---|---|
| Contents | `write` | clone + push the work branch |
| Metadata | `read` | mandatory dependency |
| Pull requests | **omit** | the load-bearing decision — see below |
| Workflows | `write` *(opt-in)* | only if tasks may edit `.github/workflows` |
| Administration, Checks, Statuses | **never** | the worker must not be able to forge its own review gate |

Store the App id and installation id and the PEM as repo **secrets** (the workflow passes
them through). The private key must live only where the controller runs.

**Why `pull_requests` is omitted.** With it, the sandbox credential can open and modify PRs
on its own. Without it, a sandbox that outlives its run can push commits to a branch nobody
is watching — and that is the entire blast radius. It cannot turn that push into a PR, modify
an existing one, or merge. If a worker legitimately needs to open its own PR, that call
belongs in the controller (which holds a separate, PR-capable credential), not in a token
handed to the sandbox.

**Honest limits — do not read a tighter fence into this than exists:**

- **`contents: write` is repository-wide, not ref-scoped.** GitHub has no ref-scoped
  installation token. A credential that outlives its run can push to *any* branch in this
  repo. What contains a stray push is **branch protection and required checks**, not token
  scope. Protect your default branch.
- **Revocation is eventually consistent.** Measured against live GitHub: after
  `DELETE /installation/token` returned `204`, the token still worked at ~2s and was rejected
  by ~7s. Revocation is defence in depth, not a fence.
- **`403` is not proof of revocation.** GitHub also returns it for rate limiting while the
  token stays valid. Only `204` and `401` prove the token is gone; anything else is logged
  and reported as a failed revocation.
- **The private key must never reach the sandbox.** If the controller and the worker share an
  env file or a mounted secret, the worker can mint its own tokens with the App's full
  permission set and the whole scheme is decorative. `daytona-worker.mjs` passes only the
  minted token into the sandbox env, never the App credentials.
- **`NANOBOTS_GITHUB_APP_WORKFLOWS=true` requires an org owner to grant Workflows: write on
  the installation first.** Requesting a permission the installation was not granted fails
  *every* token mint — not just the workflow-touching ones — and stalls every run.

**PAT fallback** stays supported and is what runs when no App is configured. If you stay on
it, scope a dedicated PAT to just this repo.

## Stacked PRs (optional, off by default)

A loop that triages into small work items produces dependent items — B needs the type or
migration A introduces. Without stacking the outer loop either serializes on merge (throughput
collapses to one PR at a time) or lets workers branch from the default branch and collide.

nanobots uses **GitHub's native stacked pull requests** (public preview since 2026-07-30) via
the `gh-stack` CLI extension (`gh extension install github/gh-stack`). It does not build
bespoke stacking machinery and does not vendor Graphite/ghstack/spr — GitHub now owns the hard
part (rebase and retarget on partial merge), and it composes with the branch protections and
merge methods nanobots already relies on.

Enable with `stacks.enabled: true` in `.nanobots/config.json`; `stacks.maxDepth` (default 3)
caps how deep a stack may go.

**Ownership.** The outer loop owns stack topology and runs every `gh stack` command. Workers
stay unaware: one branch, one PR, no stack commands in the sandbox. That is not just tidiness
— the controller is where the PR-capable credential lives, and the sandbox's per-run token
deliberately cannot restructure PRs (see "GitHub App credentials" above).

**The critical interaction — re-review after rebase.** When a lower layer merges, GitHub
automatically rebases and retargets every PR above it. Their head SHAs change with no human
action, no worker run, and no commit anyone authored. The OCR gate reviews *the exact head
SHA*, so **a stack merge silently invalidates the review on every layer above it.**

The loop's rule is therefore SHA-based, not event-based: compare the head SHA the OCR
conclusion was recorded against with the PR's current head, and treat any mismatch as
unreviewed and a hard block, re-dispatching OCR for that PR. Whether the automatic rebase
happens to fire a `synchronize` event (which would re-trigger `nanobots-ocr.yml` on its own) is
treated as an optimization, not a guarantee — this feature is days old and its event semantics
may change during preview. Comparing SHAs is correct either way.

**Conflicts.** GitHub rebases; it does not resolve semantic conflicts. On a conflicted restack
the stack is labeled blocked and escalated to a human. **Never** let an agent resolve a restack
conflict — it will re-apply or discard already-merged work, and this remains the failure mode
most likely to lose work silently.

**Merge methods.** All three work with stacks, including squash: squash creates one clean
squashed commit per pull request, so merging *n* PRs creates *n* squashed commits on the base
branch, landed atomically. The old "squash breaks stacks" footgun belonged to manual stacking
and does not apply here.

**Limits worth knowing before you turn this on:**

- **Same-repository only.** All branches in a stack must live in one repository; cross-fork
  stacks are unsupported. A fork-based contribution path cannot be stacked.
- **Merge queue support is still rolling out.** GitHub describes it as landing "progressively",
  and there is at least one open report of `Merge stack` enqueueing only the bottom PR
  ([gh-stack discussion #172](https://github.com/github/gh-stack/discussions/172)). If this
  repo uses a merge queue, verify the behavior before enabling stacked dispatch — and keep
  `stacks.enabled` handy as the off switch. When stacks do enter a queue, they queue in order,
  ejection cascades to everything above, and the merge group may exceed its configured max
  size by up to 50% to keep a stack together.
- **It is a preview.** GitHub's docs say the feature "is in public preview and subject to
  change." That is why the default is off.

## OCR review gate (required, not inside Daytona)

`nanobots init`/`update` always render `.github/workflows/nanobots-ocr.yml` alongside the
Daytona worker — this is the second non-optional piece, for the same reason Daytona is
required: without it there's no independent review to act on before merge. It runs as a
**normal GitHub Actions job** on `nanobots:built` PRs — deliberately *not* inside the
Daytona sandbox. OCR only reads a diff and calls an LLM; it doesn't need arbitrary code
execution, so the ordinary isolation an Actions runner already gives you (ephemeral, one
job, secrets scoped to that job) is sufficient, and skipping a second sandbox avoids
inventing a relay service just to keep a model key out of a box that was already going to
be destroyed.

The workflow checks out the PR's **base** commit first, `persist-credentials: false` — the
review/autofix scripts that judge a PR always come from the trusted base, never from the
PR's own head, so a PR can't rewrite the code that reviews it. It pins
[Alibaba Open Code Review](https://github.com/alibaba/open-code-review) at
`v1.7.12`, reviews the exact PR head SHA (never a branch name — a new commit
invalidates the prior review), and submits a real PR review — inline comments plus
`APPROVE`/`REQUEST_CHANGES` (or `COMMENT` if `OCR_AUTO_REVIEW_EVENTS=false`) — bound to that
SHA, plus a sticky summary comment. Blocking severities default to
`critical, high`; anything at or above those fails the job, which **is** the
`nanobots/ocr` check — the outer loop won't merge until it's green on the *current* head.
The full finding list (fingerprinted, uncapped) is also written to a report artifact —
that's what the autofix responder below reads.

### Surgical autofix responder (opt-in — the one write-capable OCR piece)

Set `OCR_AUTOFIX_ENABLED=true` (a GitHub Actions **variable**, not `config.json`) and every
eligible `nanobots:built` PR gets its blocking findings evaluated by a second model, which
proposes **exact, atomic text replacements** — never free-form patches or shell commands —
validated mechanically before anything touches a file. This is optional because it's the
one place besides the worker itself where something writes code; review alone (above) is
always on regardless.

**Eligible** means: same-repository PR (never a fork), not a draft, labeled
`nanobots:built`, base branch not in `mergePolicy.protectedBranches`, and under the round
cap (`OCR_AUTOFIX_MAX_ROUNDS`, default 3, tracked in a sticky `nanobots:ocr-responder-state`
comment so reruns on the same head are idempotent — see `.nanobots/ocr-autofix-controller.mjs`).
Protected paths (`.github/**`, `.nanobots/**`, lockfiles, and anything your `config.json`
`ocr.autofix.protectedPaths` adds) always come back `needs_human`, never a patch — same for
anything the model itself isn't confident about.

Flow, in order: the controller (Actions runner) resolves eligibility and the fixer model
config, provisions one disposable Daytona sandbox, clones the exact reviewed SHA into it,
hands it a bounded input (findings + policy + caps, never secrets beyond the fixer
credential), and the **worker inside that sandbox** — `.nanobots/ocr-autofix-worker.mjs` —
groups findings by file, builds bounded excerpts (no whole-file sends, no file-size gate:
large files just mean more/bigger excerpts), calls the fixer model, validates every
proposed replacement (exact match, unique in the complete original file, inside a permitted
excerpt, no overlaps — see `.nanobots/ocr-autofix-lib.mjs`), applies a file's edits
atomically (one invalid edit rejects that whole file's batch), runs your configured gates,
and — only if gates pass and the remote head still matches what it started from — pushes
**exactly one repair commit**. The controller then replies to and resolves the `fixed`/
`false_positive` review threads (evidence attached), leaves `needs_human` threads open, and
explicitly dispatches the next OCR round for the new head (a bot-authored push doesn't
recursively trigger workflows, so this is deliberate, not automatic).

### Autofix credential placement (the threat boundary that matters)

| Credential | Where | Never here |
|---|---|---|
| `DAYTONA_API_KEY` | Actions controller only | the sandbox |
| `OCR_LLM_TOKEN` (reviewer) | the review step's env only | the autofix step's env, the sandbox |
| `OCR_AUTOFIX_TOKEN` (fixer, falls back to `OCR_LLM_TOKEN`) | injected into the remediation sandbox for one run | anywhere durable |
| GitHub push credential | the Actions job's own `github.token`, embedded in the sandbox's git remote URL for one run | outside that one clone |

The push credential is deliberately the workflow's own scoped, ephemeral `github.token` —
not a separate PAT — which GitHub already refuses to use against fork PRs, so "same-repo
only" is enforced by GitHub itself, not by application logic alone. It's still injected into
a disposable sandbox for the run's duration (same tradeoff as the worker's `GH_TOKEN`, see
"Security model" above), destroyed with the sandbox seconds later.

### Model configuration reference

Reviewer and fixer resolve **independently**; DeepSeek V4 Flash is the shared no-override
default for both. Precedence: `workflow_dispatch` input → GitHub variable/secret →
`config.json` policy → safe default.

| GitHub variable | Default | Meaning |
|---|---|---|
| `OCR_LLM_URL` | `https://api.deepseek.com/chat/completions` | reviewer endpoint |
| `OCR_LLM_MODEL` | `deepseek-v4-flash` | reviewer model |
| `OCR_AUTOFIX_MODEL` | falls back to `OCR_LLM_MODEL`, then the default | fixer model |
| `OCR_AUTOFIX_URL` | falls back to `OCR_LLM_URL`, then the default | fixer endpoint |
| `OCR_AUTOFIX_ENABLED` | `false` unless exactly `true` | the one write-capable switch |
| `OCR_AUTOFIX_MAX_ROUNDS` | `3` (or `config.json` `ocr.maxRounds`) | autonomous round cap per PR |
| `OCR_AUTOFIX_MAX_FINDINGS` / `_MAX_FILES` / `_MAX_CHANGED_LINES` | `80` / `20` / `250` | per-round caps |
| `OCR_AUTOFIX_CONTEXT_LINES` / `_MAX_EXCERPT_CHARS` | `80` / `24000` | excerpt bounds sent to the model |
| `OCR_AUTOFIX_VALIDATION_COMMAND` | your `config.json` gates | trusted maintainer override |

Secrets: `OCR_LLM_TOKEN` (required for review), `OCR_AUTOFIX_TOKEN` (optional, falls back to
`OCR_LLM_TOKEN`). URLs must be HTTPS; model IDs are validated for shape only, never against
a hardcoded list, since they're endpoint-specific.

## Disposable database (optional, per-repo)

Never point a worker at a shared dev/staging/production database. If your gates need a
real one, set `daytona.databaseBootstrap` in `.nanobots/config.json` to a list of shell
commands `daytona-worker.mjs` runs inside the sandbox before the gates — e.g. start a
container, load a fixture, run a proof query. It's your repo's choice of engine and
fixture; nanobots doesn't ship a default. Loopback-only; nothing outside the sandbox ever
sees the connection string.

## Board cheat-sheet (`gh` ≥2.80)

```bash
gh project list --owner TimHeckel --format json \
  | jq '.projects[] | select(.title=="Nanobots") | {number, id}'

# Field + option IDs (needed for item-edit)
gh project field-list <number> --owner TimHeckel --format json

# Items by status — ALWAYS pass --limit (default is 30, silent truncation)
gh project item-list <number> --owner TimHeckel -L 200 --format json \
  --query 'status:"In Progress"'

# Add an issue to the board
gh project item-add <number> --owner TimHeckel --url <issue-url>

# Move an item (node IDs, not numbers; ONE field per invocation)
gh project item-edit --project-id <PROJECT_ID> --id <ITEM_ID> \
  --field-id <STATUS_FIELD_ID> --single-select-option-id <OPTION_ID>
```

## Auth facts (hard-won, don't rediscover)

- All `gh project` commands need the classic `project` scope (`gh auth refresh -s project`).
- In Actions, the default `GITHUB_TOKEN` **cannot** access org Projects v2 at all — the
  outer workflow injects `GH_TOKEN: secrets.PROJECTS_PAT` for exactly this reason. Use a
  **classic** PAT; fine-grained PATs are unreliable against Projects v2 GraphQL.
- Board changes (`projects_v2_item` events) **cannot trigger repo workflows** — only
  GitHub Apps/org webhooks receive them. Hence: the loop polls on its cadence.
- Dispatch comments must come from a **human** account — claude-code-action refuses runs
  initiated by bot actors, so `@claude` comments posted by `github-actions[bot]` would
  fire and then refuse. Second reason the PAT is the workflow's `GH_TOKEN`.

## Swapping the brain (DeepSeek et al)

Claude Code stays the harness; any Anthropic-compatible API can serve the tokens. Set on
the runtime that should use it (per-process, so engines mix freely across runtimes):

```bash
export ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic
export ANTHROPIC_AUTH_TOKEN=sk-<deepseek-key>
export ANTHROPIC_MODEL=deepseek-chat
export ANTHROPIC_SMALL_FAST_MODEL=deepseek-chat
npx nanobots-sh run worker
```

Same prompts, same claims, same PRs, same sandbox — the board can't tell. Recommended
split: cheap models for **workers** (start on `Size: S` items; widen if the merge rate
holds — the PR gates and OCR catch their misses), a frontier model for the **outer loop**,
where triage/merge/distill judgment compounds. The OCR reviewer/fixer models are configured
separately (see "Model configuration reference" above) — they don't have to match whatever
runs the outer loop or workers.

## Worker engine is swappable

Claude Code is the shipped default, not a requirement. A worker is anything that reads a
work-spec and opens a PR with `Closes #N`, so Codex, Copilot's coding agent, OpenHands,
aider, or a local model server all satisfy the same contract.

Bind it with two repo **variables** (no code changes):

| Variable | Meaning |
|---|---|
| `NANOBOTS_WORKER_CMD` | Shell command to run instead of `claude -p`. Gets the prompt on **stdin** and at `$NANOBOTS_PROMPT_FILE`, with the repo checked out as the working directory. |
| `NANOBOTS_WORKER_ENV` | Comma-separated names of extra secrets to forward into the sandbox (e.g. `OPENAI_API_KEY`). |

**Billing is the credential you supply, not a mode.** `CLAUDE_CODE_OAUTH_TOKEN` runs the
default engine on a Claude Pro/Max **subscription**; `ANTHROPIC_API_KEY` runs it **metered**;
any other provider's key runs a different engine entirely. Nothing else changes.

`NANOBOTS_WORKER_ENV` is an explicit allowlist, never a blanket forward — the sandbox must
not inherit the controller's environment. Naming `DAYTONA_API_KEY` or any
`NANOBOTS_GITHUB_APP_*` value is refused outright: those are controller-only, and a worker
that could read the App private key could mint its own credentials.

A "worker" is anything that can read the issue's work-spec comment, run inside the
sandbox `daytona-worker.mjs` provisions, and open a PR with `Closes #N`. Claude Code is
the shipped implementation; a developer with a Copilot subscription can assign the issue
to Copilot's coding agent instead if they'd rather skip the Daytona path for one item —
the outer loop reviews the resulting PR the same way either way.

## Hard rules

- No location-specific branches in prompts beyond capability degradation (the Actions
  outer run models this: "no local/prod access → escalate instead").
- Secrets never in the repo; the outer loop's two env vars, `DAYTONA_API_KEY` on whatever
  triggers `run worker`, and `OCR_LLM_TOKEN` (+ optional `OCR_AUTOFIX_TOKEN`) on the OCR
  workflow only.
- A sandbox is deleted in `daytona-worker.mjs`'s / `ocr-autofix-controller.mjs`'s `finally`
  block, always — a runtime that dies mid-cycle leaves no sandbox behind and no cleanup
  debt. Provider auto-delete is a backstop, never the primary cleanup path.
- Logs shown in GitHub comments are sanitized: no tokens, no `Authorization`/cookie
  headers, no raw unbounded terminal output.
- A failed or malformed OCR review, a failed autofix validation, or a stale head never
  counts as clean — see `.nanobots/open-code-review-report.mjs` and
  `.nanobots/ocr-autofix-worker.mjs`.
