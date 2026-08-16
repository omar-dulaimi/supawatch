#!/usr/bin/env bash
set -uo pipefail
RUN=$(gh-omar run list --repo omar-dulaimi/supawatch --workflow release --limit 1 --json databaseId --jq '.[0].databaseId')
echo "run: $RUN"
gh-omar run view "$RUN" --repo omar-dulaimi/supawatch 2>&1 | head -25
