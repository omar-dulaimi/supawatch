#!/usr/bin/env bash
# Wait for one specific workflow run id to finish, then report.
set -uo pipefail
ID="${1:?run id required}"
for i in $(seq 1 180); do
  line=$(gh-omar run view "$ID" --repo omar-dulaimi/supawatch --json status,conclusion \
    --jq '"\(.status):\(.conclusion // "")"' 2>/dev/null)
  case "$line" in
    completed:*) echo "run $ID: ${line#completed:}"; exit 0 ;;
  esac
  sleep 10
done
echo "TIMED OUT waiting for run $ID"
exit 1
