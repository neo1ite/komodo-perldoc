#!/usr/bin/env bash
set -euo pipefail

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
DIST="$ROOT/dist"
OUT="$DIST/komodo-perldoc-0.1.8.xpi"

command -v zip >/dev/null 2>&1 || {
    echo "build.sh: zip is required" >&2
    exit 1
}

mkdir -p "$DIST"
rm -f "$OUT"

cd "$ROOT"
zip -q -9 -r "$OUT" \
    install.rdf \
    chrome.manifest \
    content

echo "$OUT"
