#!/usr/bin/env bash
set -uo pipefail
until [ "$(gh-omar run list --repo omar-dulaimi/supawatch --workflow release --limit 1 --json status --jq '.[0].status' 2>/dev/null)" = "completed" ]; do
  sleep 15
done
echo "release conclusion: $(gh-omar run list --repo omar-dulaimi/supawatch --workflow release --limit 1 --json conclusion --jq '.[0].conclusion')"
echo "open PRs:"
gh-omar pr list --repo omar-dulaimi/supawatch --json number,title --jq '.[] | "\(.number): \(.title)"'
