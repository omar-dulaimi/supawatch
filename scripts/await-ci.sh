#!/usr/bin/env bash
set -uo pipefail
for i in $(seq 1 60); do
  read -r status conclusion < <(gh-omar run list --repo omar-dulaimi/supawatch --workflow ci --limit 1 --json status,conclusion --jq '.[0] | "\(.status) \(.conclusion)"')
  if [ "$status" = "completed" ]; then
    echo "ci conclusion: $conclusion"
    [ "$conclusion" = "success" ] && exit 0 || exit 1
  fi
  sleep 10
done
echo "timed out"
exit 1
