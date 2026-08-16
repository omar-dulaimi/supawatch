#!/usr/bin/env bash
set -uo pipefail
for i in $(seq 1 60); do
  status=$(gh-omar run list --repo omar-dulaimi/supawatch --workflow release --limit 1 --json status --jq '.[0].status')
  if [ "$status" = "completed" ]; then
    echo "conclusion: $(gh-omar run list --repo omar-dulaimi/supawatch --workflow release --limit 1 --json conclusion --jq '.[0].conclusion')"
    exit 0
  fi
  sleep 10
done
echo "timed out"
exit 1
