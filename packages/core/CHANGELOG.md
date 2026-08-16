# @supawatch/core

## 0.7.0

### Minor Changes

- 9314a4a: Domains now carry `hasConstraints` in the snapshot: true when the
  domain, or any domain in its base chain, has a CHECK constraint or NOT
  NULL. The seed target uses it to stop guessing: a base-type placeholder
  for a constrained domain can violate its CHECK and make the whole
  seed.sql fail to apply (found by dogfooding). Constrained domain columns
  are now omitted when nullable or defaulted and skip their table with a
  named reason when required; unconstrained domains seed as their base
  type, unchanged. Skips also cascade: a table whose required foreign key
  references an unseeded table is skipped too, so the emitted file always
  applies. Committed schema.lock.json files gain the new domain field on
  first regenerate after upgrading; `supawatch generate` heals the
  one-time drift.

## 0.6.0

### Minor Changes

- 0fbe207: Eight new targets: effect (Effect Schema structs, verified as a fifth
  parity verdict), rest (Hono route modules), service (typed repositories
  over postgres.js), orpc (oRPC routers), graphql (an executable Pothos
  schema), pgtap (a plan-counted structural test suite), rls (policy
  skeletons for exactly the tables that need attention), and pgmq (typed
  queue clients per detected queue).

  Core grows an RLS facet: tables now carry `rlsEnabled` and their
  `pg_policies` rows, and the watcher diff reports RLS enables, disables,
  policy creates, and policy drops as they happen.

## 0.5.0

## 0.4.0

### Minor Changes

- 21630d2: Documentation and realtime surfaces. schema-card emits a token-lean
  schema summary for LLM prompts and agent context. dictionary emits a
  markdown data dictionary whose comments come from Postgres itself, via
  new table and column comment introspection that also feeds the diff, so
  a comment change regenerates live. realtime emits typed supabase-js
  payload aliases per table under the measured PostgREST wire profile.
  Enum-array columns now keep a reference to their element enum so
  wire-profile targets recover real labels, and the watcher aggregates
  prunes across targets sharing an output directory instead of letting
  one target delete another's files.
- bbdd431: AI surfaces on a new functions facet. Core introspects plain Postgres
  functions (args with defaults, return types, set-returning), the diff
  reports them, and the Database bridge's Functions placeholder is now
  filled for typed supabase-js rpc calls. The mcp target emits a generated
  MCP server with list and get tools per table, validated by the generated
  Zod schemas and proven over a real client and server pair. The ai-tools
  target emits Vercel AI SDK tool definitions on the same plan.

## 0.3.0

## 0.2.0

### Minor Changes

- 7c10e96: Four new targets. erd emits a GitHub-rendered Mermaid ER diagram with PK
  and FK markers. schema-lock emits a canonical committed snapshot that
  turns pull-request diffs into schema changelogs and lets check catch
  schema drift. json-schema emits draft-07 schemas per table with an Ajv
  verifier, ground-truth checked like every validator target. fast-check
  emits arbitraries producing rows shaped like real driver output, with a
  suite guarantee that every arbitrary satisfies the generated Zod schema.

  Core now introspects primary keys (Table.primaryKey), and the Target
  seam gained assembleFile for non-module outputs and a per-target barrel
  opt-out.

## 0.1.3

### Patch Changes

- e650db3: Proper npm pages: every package now ships a focused README, a
  description, and keywords. No code changes.

## 0.1.2

### Patch Changes

- bc8f8bf: Two fixes found by dogfooding the published packages in a fresh consumer
  project. The barrel now ships an index.d.mts beside index.mjs, because a
  strict TypeScript consumer cannot type barrel imports without it. And
  DATABASE_URL falls back to a minimal ./.env read (flat file, no
  expansion) when the variable is not exported, which is how real projects
  keep it.

## 0.1.1

### Patch Changes

- First complete release. The 0.1.0 versions of supawatch, core, target-zod
  and watch were published from a stale phase-1 checkout and predate waves 1
  through 5; 0.1.1 is the first version carrying the full feature set: four
  validator targets plus the Database bridge, both measured driver profiles,
  arrays and the extended scalar map, variants, barrels, jsonTypes, and the
  release scaffolding.
