#!/usr/bin/env bash
# Waits until the bare supawatch package reaches the given version on the
# registry, or a release run concludes failure, whichever comes first.
set -uo pipefail
WANT="${1:?version required}"
for i in $(seq 1 60); do
  v=$(npm view supawatch version 2>/dev/null)
  if [ "$v" = "$WANT" ]; then
    echo "registry at $WANT"
    exit 0
  fi
  concl=$(gh-omar run list --repo omar-dulaimi/supawatch --workflow release --limit 1 --json status,conclusion --jq '.[0] | "\(.status):\(.conclusion)"' 2>/dev/null)
  if [ "$concl" = "completed:failure" ]; then
    echo "release run FAILED before $WANT reached the registry"
    exit 1
  fi
  sleep 10
done
echo "timed out waiting for $WANT (registry at ${v:-unknown})"
exit 1
