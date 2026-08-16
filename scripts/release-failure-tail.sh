#!/usr/bin/env bash
set -uo pipefail
RUN=$(gh-omar run list --repo omar-dulaimi/supawatch --workflow release --limit 1 --json databaseId --jq '.[0].databaseId')
gh-omar run view "$RUN" --repo omar-dulaimi/supawatch --log-failed 2>/dev/null |
  awk 'index($0, "packages published") || index($0, "error") || index($0, "403") || index($0, "404") || index($0, "E4") || index($0, "ENEED") || index($0, "success") || index($0, "failed")' |
  tail -30
