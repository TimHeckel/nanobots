#!/usr/bin/env bash
# nanobots:engine-owned v0.2 — re-rendered by `nanobots update`
# One-shot loop cycle.
# See .nanobots/RUNTIMES.md for the contract and scheduling examples.
#
# Usage: run-cycle.sh <outer|worker>
#   outer          runs locally/headless, wherever this is invoked from.
#   worker         does NOT build locally — claims + runs a Daytona sandbox
#                  (.nanobots/daytona-worker.mjs) and deletes it when done.
#   worker-inline  internal: what daytona-worker.mjs execs INSIDE the sandbox.
#                  Don't call this directly outside a sandbox.
#
# Env:   GH_TOKEN (classic PAT: project+repo+read:org, human account)
#        One model credential:
#          CLAUDE_CODE_OAUTH_TOKEN  (Claude subscription)
#          ANTHROPIC_API_KEY        (Claude metered API)
#          ANTHROPIC_AUTH_TOKEN + ANTHROPIC_BASE_URL + ANTHROPIC_MODEL
#                                   (Anthropic-compatible provider, e.g. DeepSeek)
#        worker only: DAYTONA_API_KEY (controller-side; never enters the sandbox)
#        NANOBOTS_SKIP_PERMISSIONS=1 inside the sandbox only (it's already disposable)
set -euo pipefail

ROLE="${1:?usage: run-cycle.sh <outer|worker>}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

[ -n "${GH_TOKEN:-}" ] || { echo "GH_TOKEN not set" >&2; exit 2; }
[ -n "${CLAUDE_CODE_OAUTH_TOKEN:-}${ANTHROPIC_API_KEY:-}${ANTHROPIC_AUTH_TOKEN:-}" ] \
  || { echo "need CLAUDE_CODE_OAUTH_TOKEN, ANTHROPIC_API_KEY, or ANTHROPIC_AUTH_TOKEN (+_BASE_URL/_MODEL)" >&2; exit 2; }

case "$ROLE" in
  outer)
    PROMPT_FILE=".nanobots/LOOP-PROMPT.md"
    ;;
  worker)
    [ -n "${DAYTONA_API_KEY:-}" ] || { echo "DAYTONA_API_KEY not set — workers always run in Daytona now, see .nanobots/RUNTIMES.md" >&2; exit 2; }
    exec node .nanobots/daytona-worker.mjs
    ;;
  worker-inline)
    PROMPT_FILE=".nanobots/WORKER-PROMPT.md"
    ;;
  *) echo "unknown role: $ROLE (want outer|worker)" >&2; exit 2 ;;
esac

# Fresh view of the repo; the board is the source of truth, the default branch is the baseline.
git fetch origin --quiet || true

PERM_ARGS=()
if [ "${NANOBOTS_SKIP_PERMISSIONS:-0}" = "1" ]; then
  PERM_ARGS+=(--dangerously-skip-permissions)
else
  PERM_ARGS+=(--permission-mode acceptEdits)
fi

# The agent gets the prompt plus the one-shot contract. Written to a file so any engine can
# read it, however it prefers to take input.
RENDERED_PROMPT="$(cat "$PROMPT_FILE")

You are running headless (one-shot). Execute exactly one cycle, then exit — do not
schedule wakeups; the host timer is the cadence."

# The worker's assignment. WORKER-PROMPT.md talks about "the issue" and "your run ID", so
# without these the agent has nothing to act on and simply asks what to do. The controller
# already claimed the item; it passes the identifiers in via the environment.
if [ "$ROLE" = "worker-inline" ] && [ -n "${NANOBOTS_ISSUE:-}" ]; then
  RENDERED_PROMPT="$RENDERED_PROMPT

## Your assignment (from the controller that claimed it)

- Repository: ${NANOBOTS_REPO:-unknown}
- Issue to implement: #${NANOBOTS_ISSUE}
- Your run ID: ${NANOBOTS_RUN_ID:-unknown}

Start by reading issue #${NANOBOTS_ISSUE} and its work-spec comment
(\`gh issue view ${NANOBOTS_ISSUE} --repo ${NANOBOTS_REPO:-} --comments\`). That comment is your
contract. Do not ask which item to work on — this is it. Do not pick a different one."
fi

# ── swappable engine ─────────────────────────────────────────────────────────
# Claude Code is the shipped default, not a requirement. A worker is anything that reads a
# work-spec and opens a PR with `Closes #N`, so Codex, Copilot's coding agent, OpenHands,
# aider, or a local model server all fit the same contract.
#
# Set NANOBOTS_WORKER_CMD to any shell command. It runs with:
#   $NANOBOTS_PROMPT_FILE — path to the rendered prompt (also piped on stdin)
#   the repo checked out at the working directory
#   whatever credentials you listed in NANOBOTS_WORKER_ENV (see RUNTIMES.md)
# Billing is the credential you supply, not a mode: CLAUDE_CODE_OAUTH_TOKEN for a Claude
# subscription, ANTHROPIC_API_KEY for metered, or any provider's key for another engine.
if [ -n "${NANOBOTS_WORKER_CMD:-}" ]; then
  RENDERED_FILE="$(mktemp)"
  printf '%s' "$RENDERED_PROMPT" > "$RENDERED_FILE"
  export NANOBOTS_PROMPT_FILE="$RENDERED_FILE"
  echo "[run-cycle] engine: custom (NANOBOTS_WORKER_CMD)" >&2
  # shellcheck disable=SC2086
  printf '%s' "$RENDERED_PROMPT" | exec sh -c "$NANOBOTS_WORKER_CMD"
fi

exec claude -p "$RENDERED_PROMPT" \
  "${PERM_ARGS[@]}" \
  --output-format text
