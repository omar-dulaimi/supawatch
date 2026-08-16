#!/usr/bin/env bash
set -uo pipefail
RUN=$(gh-omar run list --repo omar-dulaimi/supawatch --workflow release --limit 5 --json databaseId,conclusion --jq '[.[] | select(.conclusion == "failure")][0].databaseId')
echo "failed run: $RUN"
gh-omar run view "$RUN" --repo omar-dulaimi/supawatch --log-failed 2>/dev/null |
  awk 'index($0, "err") || index($0, "fail") || index($0, "403") || index($0, "422") || index($0, "Error")' | tail -12
