#!/usr/bin/env bash
# Fails if any tracked source file contains an em dash or en dash.
set -euo pipefail
cd "$(dirname "$0")/.."
bad=0
while IFS= read -r f; do
  if awk 'index($0, "\xe2\x80\x94") || index($0, "\xe2\x80\x93") { exit 1 }' "$f"; then
    :
  else
    echo "dash found: $f"
    bad=1
  fi
done < <(git ls-files '*.ts' '*.md' '*.sh' '*.sql' '*.json' '*.yml')
if [ "$bad" -eq 0 ]; then echo "no dashes"; fi
exit "$bad"
