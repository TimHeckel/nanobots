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
2. has `GH_TOKEN` — classic PAT, scopes `project` + `repo` (must belong to a **human**
   account: claude-code-action refuses bot actors on dispatch),
3. has ONE model credential (`CLAUDE_CODE_OAUTH_TOKEN`, `ANTHROPIC_API_KEY`, or
   `ANTHROPIC_AUTH_TOKEN` + `_BASE_URL` + `_MODEL` — see "Swapping the brain"),
4. runs `.nanobots/LOOP-PROMPT.md` for **one cycle** and exits.

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
2. finds the top **Ready** item that is not `{{HUMAN_LABEL}}` and, if
   `approval.requireVersionedStart` is on (the default), has an unexpired
   `/nanobots start <plan-hash>` approval from a collaborator matching the current plan
   comment — see the Dispatch step in `.nanobots/LOOP-PROMPT.md`;
3. claims it (move to In Progress, comment with the run ID) and re-reads to confirm no one
   else's claim beat it;
4. creates a Daytona sandbox from snapshot `{{DAYTONA_SNAPSHOT}}` in target
   `{{DAYTONA_TARGET}}`, labeled `nanobots-{{OWNER}}-{{REPO}}-<issue>-<attempt>`;
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
- `GH_TOKEN` — the same classic PAT the outer loop uses, injected into that one sandbox's
  environment so the agent can push and open the PR directly. This is a deliberate
  simplification versus a fully mediated "controller performs every git/GitHub mutation,
  model never touches a token" design: nanobots has no hosted control plane or GitHub App
  to mint short-lived, repo-scoped installation tokens, and building one is disproportionate
  to what a scaffolder should carry. The mitigation is the sandbox itself — the token lives
  only inside a disposable environment that's destroyed within minutes of the run ending,
  never written to a shared machine, and never logged (see redaction rules below).
- The model credential (whichever one the triggering process was given).
- Nothing else. No production database URL, no cloud credentials, no other repo's secrets.

**If your repo can't accept that tradeoff** (e.g. the PAT has access to other repos too),
scope a dedicated PAT to just this repo, or wire up a GitHub App installation token
yourself and inject it in place of `GH_TOKEN` in `daytona-worker.mjs` — the script has one
clearly marked injection point.

## OCR review gate (required, not inside Daytona)

`nanobots init`/`update` always render `.github/workflows/nanobots-ocr.yml` alongside the
Daytona worker — this is the second non-optional piece, for the same reason Daytona is
required: without it there's no independent review to act on before merge. It runs as a
**normal GitHub Actions job** on `nanobots:built` PRs — deliberately *not* inside the
Daytona sandbox. OCR only reads a diff
and calls an LLM; it doesn't need arbitrary code execution, so the ordinary isolation an
Actions runner already gives you (ephemeral, one job, secrets scoped to that job) is
sufficient, and skipping a second sandbox avoids inventing a relay service just to keep a
model key out of a box that was already going to be destroyed.

The workflow pins [Alibaba Open Code Review](https://github.com/alibaba/open-code-review)
at `{{OCR_VERSION}}`, reviews the exact PR head SHA (never a branch name — a new commit
invalidates the prior review), and posts one sticky comment plus a `nanobots/ocr` check.
Blocking severities default to `{{OCR_BLOCKING_SEVERITIES}}`; anything at or above those
holds the PR — the outer loop won't merge until the check is green on the *current* head.

## Disposable database (optional, per-repo)

Never point a worker at a shared dev/staging/production database. If your gates need a
real one, set `daytona.databaseBootstrap` in `.nanobots/config.json` to a list of shell
commands `daytona-worker.mjs` runs inside the sandbox before the gates — e.g. start a
container, load a fixture, run a proof query. It's your repo's choice of engine and
fixture; nanobots doesn't ship a default. Loopback-only; nothing outside the sandbox ever
sees the connection string.

## Board cheat-sheet (`gh` ≥2.80)

```bash
gh project list --owner {{OWNER}} --format json \
  | jq '.projects[] | select(.title=="{{BOARD}}") | {number, id}'

# Field + option IDs (needed for item-edit)
gh project field-list <number> --owner {{OWNER}} --format json

# Items by status — ALWAYS pass --limit (default is 30, silent truncation)
gh project item-list <number> --owner {{OWNER}} -L 200 --format json \
  --query 'status:"In Progress"'

# Add an issue to the board
gh project item-add <number> --owner {{OWNER}} --url <issue-url>

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
holds — the PR gates and OCR (if enabled) catch their misses), a frontier model for the
**outer loop**, where triage/merge/distill judgment compounds.

## Worker engine is swappable

A "worker" is anything that can read the issue's work-spec comment, run inside the
sandbox `daytona-worker.mjs` provisions, and open a PR with `Closes #N`. Claude Code is
the shipped implementation; a developer with a Copilot subscription can assign the issue
to Copilot's coding agent instead if they'd rather skip the Daytona path for one item —
the outer loop reviews the resulting PR the same way either way.

## Hard rules

- No location-specific branches in prompts beyond capability degradation (the Actions
  outer run models this: "no local/prod access → escalate instead").
- Secrets never in the repo; the outer loop's two env vars, plus `DAYTONA_API_KEY` on
  whatever triggers `run worker`.
- A sandbox is deleted in `daytona-worker.mjs`'s `finally` block, always — a runtime that
  dies mid-cycle leaves no sandbox behind and no cleanup debt.
- Logs shown in GitHub comments are sanitized: no tokens, no `Authorization`/cookie
  headers, no raw unbounded terminal output.
