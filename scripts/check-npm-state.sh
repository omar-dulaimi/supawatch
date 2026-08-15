#!/usr/bin/env bash
set -uo pipefail
for p in supawatch @supawatch/core @supawatch/target-zod @supawatch/watch \
  @supawatch/target-valibot @supawatch/target-arktype @supawatch/target-typebox \
  @supawatch/target-supabase-types @supawatch/verify; do
  v=$(npm view "$p" version 2>/dev/null)
  echo "$p: ${v:-NOT PUBLISHED}"
done
