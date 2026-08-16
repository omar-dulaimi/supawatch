#!/usr/bin/env bash
# Waits for a release run NEWER than the given marker id (or newer than
# the current latest when no marker is passed) to complete, then reports
# its conclusion and the open PRs. The marker exists because polling
# "latest completed" races: right after a push, the latest completed run
# is still the previous one.
set -uo pipefail
MARKER="${1:-}"
latest_id() {
  gh-omar run list --repo omar-dulaimi/supawatch --workflow release --limit 1 \
    --json databaseId --jq '.[0].databaseId' 2>/dev/null
}
if [ -z "$MARKER" ]; then
  MARKER=$(latest_id)
  echo "waiting for a release run newer than $MARKER"
fi
for i in $(seq 1 60); do
  id=$(latest_id)
  if [ -n "$id" ] && [ "$id" != "$MARKER" ]; then
    status=$(gh-omar run list --repo omar-dulaimi/supawatch --workflow release --limit 1 --json status --jq '.[0].status')
    if [ "$status" = "completed" ]; then
      echo "release conclusion: $(gh-omar run list --repo omar-dulaimi/supawatch --workflow release --limit 1 --json conclusion --jq '.[0].conclusion')"
      echo "open PRs:"
      gh-omar pr list --repo omar-dulaimi/supawatch --json number,title --jq '.[] | "\(.number): \(.title)"'
      exit 0
    fi
  fi
  sleep 10
done
echo "timed out waiting for a new completed release run"
exit 1
