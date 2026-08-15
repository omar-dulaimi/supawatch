#!/usr/bin/env bash
set -uo pipefail
for p in supawatch @supawatch/core @supawatch/target-zod @supawatch/watch; do
  d=$(npm view "$p@0.1.0" deprecated 2>/dev/null)
  echo "$p@0.1.0: ${d:-NOT deprecated}"
done
