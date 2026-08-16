#!/usr/bin/env bash
set -uo pipefail
for p in supawatch @supawatch/core @supawatch/target-zod @supawatch/watch \
  @supawatch/target-valibot @supawatch/target-arktype @supawatch/target-typebox \
  @supawatch/target-supabase-types @supawatch/verify \
  @supawatch/target-erd @supawatch/target-schema-lock @supawatch/target-json-schema \
  @supawatch/target-fast-check @supawatch/target-forms @supawatch/target-factories \
  @supawatch/target-trpc @supawatch/target-schema-card @supawatch/target-dictionary \
  @supawatch/target-realtime @supawatch/target-mcp @supawatch/target-ai-tools \
  @supawatch/target-seed @supawatch/target-effect @supawatch/target-rest \
  @supawatch/target-service @supawatch/target-orpc @supawatch/target-graphql \
  @supawatch/target-pgtap @supawatch/target-rls @supawatch/target-pgmq; do
  v=$(npm view "$p" version 2>/dev/null)
  echo "$p: ${v:-NOT PUBLISHED}"
done
