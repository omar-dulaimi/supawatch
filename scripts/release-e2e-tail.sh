#!/usr/bin/env bash
set -uo pipefail
gh-omar run view 31945419284 --repo omar-dulaimi/supawatch --log-failed 2>/dev/null |
  awk '/== 2b/,/exit code 254/' | awk '!index($0, "Pull") && !index($0, "Extracting")' | head -25
