#!/usr/bin/env bash
set -uo pipefail
RUN=$(gh-omar run list --repo omar-dulaimi/supawatch --workflow release --limit 1 --json databaseId --jq '.[0].databaseId')
echo "run: $RUN"
gh-omar run view "$RUN" --repo omar-dulaimi/supawatch --log-failed 2>/dev/null |
  awk 'index($0, "err") || index($0, "publish") || index($0, "403") || index($0, "404") || index($0, "OIDC") || index($0, "trusted") || index($0, "New tag")' |
  head -30
