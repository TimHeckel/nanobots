#!/usr/bin/env bash
# Build the Chrome Web Store upload zip: extension/ → dist/nanobots-extension-<version>.zip
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$ROOT/extension/manifest.json')).version)")
mkdir -p "$ROOT/dist"
OUT="$ROOT/dist/nanobots-extension-$VERSION.zip"
rm -f "$OUT"
cd "$ROOT/extension"
zip -r "$OUT" . -x "*.DS_Store" -x "README.md" >/dev/null
echo "wrote $OUT"
unzip -l "$OUT" | tail -3
