# supawatch

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

### Patch Changes

- Updated dependencies [0fbe207]
  - @supawatch/core@0.6.0
  - @supawatch/target-effect@0.6.0
  - @supawatch/target-rest@0.6.0
  - @supawatch/target-service@0.6.0
  - @supawatch/target-orpc@0.6.0
  - @supawatch/target-graphql@0.6.0
  - @supawatch/target-pgtap@0.6.0
  - @supawatch/target-rls@0.6.0
  - @supawatch/target-pgmq@0.6.0
  - @supawatch/target-ai-tools@0.6.0
  - @supawatch/target-arktype@0.6.0
  - @supawatch/target-dictionary@0.6.0
  - @supawatch/target-erd@0.6.0
  - @supawatch/target-factories@0.6.0
  - @supawatch/target-fast-check@0.6.0
  - @supawatch/target-forms@0.6.0
  - @supawatch/target-json-schema@0.6.0
  - @supawatch/target-mcp@0.6.0
  - @supawatch/target-realtime@0.6.0
  - @supawatch/target-schema-card@0.6.0
  - @supawatch/target-schema-lock@0.6.0
  - @supawatch/target-seed@0.6.0
  - @supawatch/target-supabase-types@0.6.0
  - @supawatch/target-trpc@0.6.0
  - @supawatch/target-typebox@0.6.0
  - @supawatch/target-valibot@0.6.0
  - @supawatch/target-zod@0.6.0
  - @supawatch/watch@0.6.0

## 0.5.0

### Minor Changes

- e508d5f: The seed target: deterministic, FK-aware seed.sql. Topologically ordered
  inserts, explicit identity ids via OVERRIDING SYSTEM VALUE, sequence
  resync with setval, real enum labels, byte-stable output, and honest
  skip comments for cycles, multi-column foreign keys, and unliteralable
  required columns. Proven against a real empty database, with seeded rows
  ground-truth checked by the generated Zod schemas.

### Patch Changes

- Updated dependencies [e508d5f]
  - @supawatch/target-seed@0.5.0
  - @supawatch/core@0.5.0
  - @supawatch/target-ai-tools@0.5.0
  - @supawatch/target-arktype@0.5.0
  - @supawatch/target-dictionary@0.5.0
  - @supawatch/target-erd@0.5.0
  - @supawatch/target-factories@0.5.0
  - @supawatch/target-fast-check@0.5.0
  - @supawatch/target-forms@0.5.0
  - @supawatch/target-json-schema@0.5.0
  - @supawatch/target-mcp@0.5.0
  - @supawatch/target-realtime@0.5.0
  - @supawatch/target-schema-card@0.5.0
  - @supawatch/target-schema-lock@0.5.0
  - @supawatch/target-supabase-types@0.5.0
  - @supawatch/target-trpc@0.5.0
  - @supawatch/target-typebox@0.5.0
  - @supawatch/target-valibot@0.5.0
  - @supawatch/target-zod@0.5.0
  - @supawatch/watch@0.5.0

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

### Patch Changes

- Updated dependencies [21630d2]
- Updated dependencies [bbdd431]
  - @supawatch/core@0.4.0
  - @supawatch/watch@0.4.0
  - @supawatch/target-schema-card@0.4.0
  - @supawatch/target-dictionary@0.4.0
  - @supawatch/target-realtime@0.4.0
  - @supawatch/target-supabase-types@0.4.0
  - @supawatch/target-mcp@0.4.0
  - @supawatch/target-ai-tools@0.4.0
  - @supawatch/target-arktype@0.4.0
  - @supawatch/target-erd@0.4.0
  - @supawatch/target-factories@0.4.0
  - @supawatch/target-fast-check@0.4.0
  - @supawatch/target-forms@0.4.0
  - @supawatch/target-json-schema@0.4.0
  - @supawatch/target-schema-lock@0.4.0
  - @supawatch/target-trpc@0.4.0
  - @supawatch/target-typebox@0.4.0
  - @supawatch/target-valibot@0.4.0
  - @supawatch/target-zod@0.4.0

## 0.3.0

### Minor Changes

- 78abb11: Three application-facing targets. forms emits framework-agnostic field
  configs per table (controls, labels, requiredness, enum options) derived
  from insert semantics. factories emits typed deterministic fixture
  factories whose default rows are guaranteed to satisfy the generated Zod
  schemas. trpc emits router factories with list, byId and create
  procedures wired to the generated Zod schemas and a postgres.js
  connection, proven in the e2e by a live createCaller round trip.

### Patch Changes

- Updated dependencies [78abb11]
  - @supawatch/target-forms@0.3.0
  - @supawatch/target-factories@0.3.0
  - @supawatch/target-trpc@0.3.0
  - @supawatch/core@0.3.0
  - @supawatch/target-arktype@0.3.0
  - @supawatch/target-erd@0.3.0
  - @supawatch/target-fast-check@0.3.0
  - @supawatch/target-json-schema@0.3.0
  - @supawatch/target-schema-lock@0.3.0
  - @supawatch/target-supabase-types@0.3.0
  - @supawatch/target-typebox@0.3.0
  - @supawatch/target-valibot@0.3.0
  - @supawatch/target-zod@0.3.0
  - @supawatch/watch@0.3.0

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

### Patch Changes

- Updated dependencies [7c10e96]
  - @supawatch/core@0.2.0
  - @supawatch/target-zod@0.2.0
  - @supawatch/target-valibot@0.2.0
  - @supawatch/target-arktype@0.2.0
  - @supawatch/target-typebox@0.2.0
  - @supawatch/target-supabase-types@0.2.0
  - @supawatch/target-erd@0.2.0
  - @supawatch/target-schema-lock@0.2.0
  - @supawatch/target-json-schema@0.2.0
  - @supawatch/target-fast-check@0.2.0
  - @supawatch/watch@0.2.0

## 0.1.3

### Patch Changes

- e650db3: Proper npm pages: every package now ships a focused README, a
  description, and keywords. No code changes.
- Updated dependencies [e650db3]
  - @supawatch/core@0.1.3
  - @supawatch/target-zod@0.1.3
  - @supawatch/target-valibot@0.1.3
  - @supawatch/target-arktype@0.1.3
  - @supawatch/target-typebox@0.1.3
  - @supawatch/target-supabase-types@0.1.3
  - @supawatch/watch@0.1.3

## 0.1.2

### Patch Changes

- bc8f8bf: Two fixes found by dogfooding the published packages in a fresh consumer
  project. The barrel now ships an index.d.mts beside index.mjs, because a
  strict TypeScript consumer cannot type barrel imports without it. And
  DATABASE_URL falls back to a minimal ./.env read (flat file, no
  expansion) when the variable is not exported, which is how real projects
  keep it.
- Updated dependencies [bc8f8bf]
  - @supawatch/core@0.1.2
  - @supawatch/target-zod@0.1.2
  - @supawatch/target-valibot@0.1.2
  - @supawatch/target-arktype@0.1.2
  - @supawatch/target-typebox@0.1.2
  - @supawatch/target-supabase-types@0.1.2
  - @supawatch/watch@0.1.2

## 0.1.1

### Patch Changes

- First complete release. The 0.1.0 versions of supawatch, core, target-zod
  and watch were published from a stale phase-1 checkout and predate waves 1
  through 5; 0.1.1 is the first version carrying the full feature set: four
  validator targets plus the Database bridge, both measured driver profiles,
  arrays and the extended scalar map, variants, barrels, jsonTypes, and the
  release scaffolding.
- Updated dependencies
  - @supawatch/core@0.1.1
  - @supawatch/target-zod@0.1.1
  - @supawatch/target-valibot@0.1.1
  - @supawatch/target-arktype@0.1.1
  - @supawatch/target-typebox@0.1.1
  - @supawatch/target-supabase-types@0.1.1
  - @supawatch/watch@0.1.1
