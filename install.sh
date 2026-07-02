#!/bin/sh
# nanobots bootstrap — curl -fsSL https://nanobots.sh | sh
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

exec npx --yes github:TimHeckel/nanobots init "$@"
