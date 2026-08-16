#!/usr/bin/env bash
# Waits for the release run on the given head sha to complete, then
# prints its conclusion and any open version PR.
set -uo pipefail
SHA="${1:?head sha required}"
for i in $(seq 1 120); do
  line=$(gh-omar run list --repo omar-dulaimi/supawatch --workflow release --limit 5 \
    --json status,conclusion,headSha \
    --jq ".[] | select(.headSha | startswith(\"$SHA\")) | \"\(.status):\(.conclusion // \"\")\"" 2>/dev/null | head -1)
  case "$line" in
    completed:*)
      echo "release on $SHA: ${line#completed:}"
      gh-omar pr list --repo omar-dulaimi/supawatch --state open \
        --json number,title,headRefName \
        --jq '.[] | "open PR #\(.number): \(.title) [\(.headRefName)]"'
      exit 0
      ;;
  esac
  sleep 10
done
echo "TIMED OUT waiting for release run on $SHA"
exit 1
