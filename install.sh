#!/bin/sh
# nanobots bootstrap — curl -fsSL nanobots.sh/install | sh
# Thin entry: verifies prerequisites, then hands off to the npx-run CLI
# in the current directory (which must be the target git repo).
set -eu

need() { command -v "$1" >/dev/null 2>&1 || { echo "nanobots: missing prerequisite: $1" >&2; exit 1; }; }
need git
need node
need npx
need gh

if ! git rev-parse --show-toplevel >/dev/null 2>&1; then
  echo "nanobots: run this from inside the git repo you want to install onto" >&2
  exit 1
fi

# `init` is an AI onboarding agent, so it needs an inference endpoint before it can say
# anything at all. Check here rather than letting npx download the whole package first and
# fail after — that reads as a broken installer. Never echo the values, only whether they
# are set.
missing=''
[ -n "${OCR_LLM_URL:-}" ]   || missing="$missing OCR_LLM_URL"
[ -n "${OCR_LLM_TOKEN:-}" ] || missing="$missing OCR_LLM_TOKEN"
[ -n "${OCR_LLM_MODEL:-}" ] || missing="$missing OCR_LLM_MODEL"

if [ -n "$missing" ]; then
  echo "nanobots: missing environment:$missing" >&2
  cat >&2 <<'EOF'

`nanobots init` is a conversation, not a script — it reads your repo and talks you through
setup, so it needs an OpenAI-compatible endpoint to think with. It is the SAME endpoint your
repo needs afterwards for the required OCR review, so this is not an extra key.

  export OCR_LLM_URL=https://api.deepseek.com/chat/completions
  export OCR_LLM_TOKEN=sk-...              # your provider key
  export OCR_LLM_MODEL=deepseek-v4-flash

Any OpenAI-compatible /chat/completions endpoint with tool-calling works — DeepSeek, OpenAI,
Together, Fireworks, or a local server.
EOF
  # Common case: the values are already in the repo's .env but were never exported. Say so
  # rather than let someone re-hunt a key they already have. The file is only grepped, never
  # sourced — sourcing an arbitrary .env executes whatever happens to be in it.
  if [ -f .env ] && grep -q '^[[:space:]]*\(export[[:space:]]\{1,\}\)\{0,1\}OCR_LLM_' .env 2>/dev/null; then
    cat >&2 <<'EOF'

Your .env already mentions OCR_LLM_* — load it into this shell first:

  set -a; . ./.env; set +a
EOF
  fi
  echo "" >&2
  echo "Then re-run: curl -fsSL nanobots.sh/install | sh" >&2
  exit 1
fi

# Under `curl … | sh` the script ITSELF is stdin, so stdin is an exhausted pipe by the time
# we get here. The onboarding agent is interactive — every question would read EOF and the
# whole install would race past the user answering nothing. Reattach the controlling
# terminal. Without this the advertised one-liner cannot work at all.
# `[ -r /dev/tty ]` is NOT a sufficient probe: with no controlling terminal the device node
# still exists and tests readable, then the open fails with a raw "Device not configured".
# Actually opening it is the only honest check.
#
# The subshell is load-bearing, not style. `:` is a POSIX SPECIAL builtin, and a redirection
# error on a special builtin terminates a non-interactive shell outright — even as an `if`
# condition. On dash (Ubuntu's /bin/sh, i.e. most `curl | sh` users) the unsubshelled form
# exits 2 right here and prints none of the help below. A subshell contains the exit and
# just yields a false condition.
if ( : < /dev/tty ) 2>/dev/null; then
  exec npx --yes nanobots-sh init "$@" < /dev/tty
fi

# No controlling terminal (CI, a nested pipeline, a container without -t). Interactive
# onboarding is impossible here, so say that plainly instead of failing mid-conversation.
if [ -t 0 ]; then
  exec npx --yes nanobots-sh init "$@"
fi

echo "nanobots: no terminal available, so the onboarding agent has nowhere to ask questions." >&2
echo "Run it directly in an interactive shell instead:" >&2
echo "" >&2
echo "  npx nanobots-sh init" >&2
exit 1
