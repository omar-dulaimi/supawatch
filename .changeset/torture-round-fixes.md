---
"@supawatch/core": minor
"@supawatch/watch": minor
"@supawatch/target-supabase-types": minor
"@supawatch/target-zod": patch
"@supawatch/target-valibot": patch
"@supawatch/target-arktype": patch
"@supawatch/target-typebox": patch
"@supawatch/target-effect": patch
"@supawatch/target-json-schema": patch
"@supawatch/target-fast-check": patch
"@supawatch/target-factories": patch
"@supawatch/target-forms": patch
"@supawatch/target-trpc": patch
"@supawatch/target-orpc": patch
"@supawatch/target-rest": patch
"@supawatch/target-service": patch
"@supawatch/target-graphql": patch
"@supawatch/target-realtime": patch
"@supawatch/target-seed": patch
"@supawatch/verify": minor
---

Six defects found by driving the pipeline over an advanced-schema
torture database, all fixed:

- Partitioned parents (relkind p) were invisible while their internal
  partitions leaked through as ordinary tables; the parent is now a
  table in the snapshot and partitions are excluded. Materialized views
  were invisible entirely; they are now views.
- Enum arrays under the postgres-js profile are REAL arrays, not raw
  literals. Measured: postgres.js fetches custom type parsers at
  connect, so every normally opened connection parses enum arrays;
  only a connection created before the enum type existed sees the raw
  literal (documented limit). Schemas now emit arrays of enum labels.
  The verify harness normalizes PGlite's raw literal under the named
  enum-array-literal-vs-array delta.
- In multi-schema runs, export names now carry the schema prefix
  (public_settingsRow), matching the existing file-name prefixing;
  before, same-named tables produced ambiguous barrel star exports,
  which ESM silently drops, so both schemas vanished without an error.
  Emitters that import the zod files (rest, service, orpc, trpc, mcp,
  ai-tools) now import by the prefixed file names, which were simply
  broken before. Naming lives in core (exportBaseName, fileBaseName).
- Sanitized-name collisions inside one schema ("a b" and "a-b") now
  fail generation loudly, naming both relations, instead of silently
  dropping the exports.
- The Database bridge quotes non-identifier keys ("Order Log", "café"),
  so exotic names no longer emit syntactically invalid TypeScript, and
  overloaded functions merge into one key with union Args and Returns
  instead of duplicate keys.
