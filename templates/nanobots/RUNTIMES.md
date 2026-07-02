<!-- nanobots:engine-owned v0.1 — re-rendered by `nanobots update`; put repo policy in TRIAGE.md/RECIPES.md/config.json instead -->
# Runtimes — run either loop anywhere

Design stance: **no adapters, one contract.** GitHub is the only coordination surface, so
an execution location is just "something that starts the same one-shot process with two
credentials." Never add location-specific logic to the loop itself.

## The runtime contract

A loop runtime is any process that:

1. has the repo checked out (or clones it),
2. has `GH_TOKEN` — classic PAT, scopes `project` + `repo` (must belong to a **human**
   account: claude-code-action refuses bot actors on dispatch),
3. has ONE model credential:
   - `CLAUDE_CODE_OAUTH_TOKEN` — Claude **subscription** billing. Mint once with
     `claude setup-token`; works headless anywhere.
   - `ANTHROPIC_API_KEY` — metered API billing (or Bedrock/Vertex via provider env).
   - `ANTHROPIC_AUTH_TOKEN` + `ANTHROPIC_BASE_URL` + `ANTHROPIC_MODEL` — any
     Anthropic-compatible provider (see "Swapping the brain").
4. runs **one cycle for one role and exits**:
   - `outer` → `.nanobots/LOOP-PROMPT.md`
   - `worker` → `.nanobots/WORKER-PROMPT.md`

Cadence always lives OUTSIDE the process (interactive `/loop`, systemd timer, Actions
cron, sandbox scheduler). One-shot + board-is-truth means any number of runtimes coexist;
the claim protocol (move card → comment → re-read) arbitrates workers.

## Launcher matrix

| Location | Outer loop | Worker | Notes |
|---|---|---|---|
| Laptop (interactive) | `/loop` + LOOP-PROMPT | `/loop` + WORKER-PROMPT | Default; you're supervising |
| VM / own box (headless) | `run-cycle.sh outer` on a timer | `run-cycle.sh worker` on a timer | The "always running" workhorse; dedicated box → `NANOBOTS_SKIP_PERMISSIONS=1` acceptable |
| GitHub Actions | `nanobots-outer.yml` (cron) | `@claude` dispatch (inner workflow) | Zero-ops floor |
| Sandbox cloud (Daytona / E2B / Modal) | same script in a sandbox | same | Contract already runs there (CLI + env vars); write the ~20-line launcher when per-item isolation or burst parallelism is actually needed |

Recommended cadences: outer 30 min, worker 5 min (a worker cycle with an empty Ready
column costs almost nothing — it reads the board and exits).

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
bash .nanobots/run-cycle.sh worker
```

Same prompts, same claims, same PRs — the board can't tell. Recommended split: cheap
models for **workers** (start on `Size: S` items; widen if the merge rate holds — the PR
gates catch their misses), a frontier model for the **outer loop**, where triage/merge/
distill judgment compounds.

## Worker engine is swappable

A "worker" is anything that can read the issue's work-spec comment and open a PR with
`Closes #N` + label `nanobots:built`. Claude Code is the shipped implementation; a
developer with a Copilot subscription can assign the issue to Copilot's coding agent
instead — the board can't tell the difference and the outer loop reviews the PR the same
way. Codex/OpenHands likewise. The contract IS the adapter.

## Hard rules

- No location-specific branches in prompts beyond capability degradation (the Actions
  outer run models this: "no local/prod access → escalate instead").
- Secrets never in the repo; each runtime carries its own two env vars.
- A runtime that dies mid-cycle needs no cleanup: unfinished claims are visible on the
  board and the outer loop's stall check (>48h, no PR) recycles them.
