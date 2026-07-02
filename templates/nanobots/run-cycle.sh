#!/usr/bin/env bash
# nanobots:engine-owned v0.1 — re-rendered by `nanobots update`
# One-shot loop cycle for headless runtimes (VM, container, sandbox).
# See .nanobots/RUNTIMES.md for the contract and scheduling examples.
#
# Usage: run-cycle.sh <outer|worker>
# Env:   GH_TOKEN (classic PAT: project+repo, human account)
#        One model credential:
#          CLAUDE_CODE_OAUTH_TOKEN  (Claude subscription)
#          ANTHROPIC_API_KEY        (Claude metered API)
#          ANTHROPIC_AUTH_TOKEN + ANTHROPIC_BASE_URL + ANTHROPIC_MODEL
#                                   (Anthropic-compatible provider, e.g. DeepSeek)
#        NANOBOTS_SKIP_PERMISSIONS=1 on dedicated/isolated machines only
set -euo pipefail

ROLE="${1:?usage: run-cycle.sh <outer|worker>}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

case "$ROLE" in
  outer)  PROMPT_FILE=".nanobots/LOOP-PROMPT.md" ;;
  worker) PROMPT_FILE=".nanobots/WORKER-PROMPT.md" ;;
  *) echo "unknown role: $ROLE (want outer|worker)" >&2; exit 2 ;;
esac

[ -n "${GH_TOKEN:-}" ] || { echo "GH_TOKEN not set" >&2; exit 2; }
[ -n "${CLAUDE_CODE_OAUTH_TOKEN:-}${ANTHROPIC_API_KEY:-}${ANTHROPIC_AUTH_TOKEN:-}" ] \
  || { echo "need CLAUDE_CODE_OAUTH_TOKEN, ANTHROPIC_API_KEY, or ANTHROPIC_AUTH_TOKEN (+_BASE_URL/_MODEL)" >&2; exit 2; }

# Fresh view of the repo; the board is the source of truth, the default branch is the baseline.
git fetch origin --quiet || true

PERM_ARGS=()
if [ "${NANOBOTS_SKIP_PERMISSIONS:-0}" = "1" ]; then
  PERM_ARGS+=(--dangerously-skip-permissions)
else
  PERM_ARGS+=(--permission-mode acceptEdits)
fi

exec claude -p "$(cat "$PROMPT_FILE")

You are running headless (one-shot). Execute exactly one cycle, then exit — do not
schedule wakeups; the host timer is the cadence." \
  "${PERM_ARGS[@]}" \
  --output-format text
