#!/usr/bin/env bash
# Packs the current build into the dogfood scratch dir for local
# verification of fixes ahead of the next publish.
set -euo pipefail
cd "$(dirname "$0")/.."
DEST="${1:?destination dir required}"
rm -rf "$DEST"
mkdir -p "$DEST"
for pkg in core target-zod target-supabase-types watch cli; do
  (cd "packages/$pkg" && pnpm pack --pack-destination "$DEST" >/dev/null)
done
ls "$DEST"
