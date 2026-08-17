# @supawatch/core

## 0.10.0

## 0.9.1

## 0.9.0

### Minor Changes

- 99797c6: Torture round 3: pathological values, degenerate types, hostile names,
  and scale (a 1600-column table, 300 tables, a 1000-label enum, a
  30-level FK chain, a live DDL storm). Measured truths now encoded:

  - Floats can really be NaN or +-Infinity and temporal columns can be
    'infinity' or BC values, which the driver hands over as those numbers
    and as Invalid Date instances. Generated schemas now accept them:
    zod unions in nan and the infinities and validates dates by
    instanceof; valibot unions nan and uses v.instance(Date); arktype
    uses number.NaN and an instanceof narrow (its Date keyword rejects
    Invalid Date); typebox registers PgFloat/PgDate kinds (idempotent,
    and the verifier registers them on its own instance too, because
    isolated installs can hold two typebox copies); effect already
    accepted all of them. The verify fixture now carries these rows
    through five-way parity.
  - Zero-label enums (create type e as enum ()) now appear in the
    snapshot as enums (LEFT JOIN; they were silently unknown) and emit
    explicit never schemas everywhere, including draft-07's "not {}".
    A NOT NULL zero-label enum column fails generation loudly.
  - Relation names containing newline, carriage return, or tab fail
    loudly: ESM resolves import specifiers as URLs and the URL parser
    strips those characters, so such a module could never be imported.
  - Dotted schema and table names that collapse onto one file name
    (schema "a.b" table "c" vs schema "a" table "b.c") fail loudly, and
    introspection's internal keying no longer collapses such pairs into
    one table.
  - Seed handles the degenerate ends: zero-label enum columns have no
    literal, unpredictable primary keys (stored-generated, or types with
    no honest literal like interval) skip their table or their children
    with named reasons.

## 0.8.0

### Minor Changes

- c95d248: Six defects found by driving the pipeline over an advanced-schema
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

- e3a62a0: A second, harsher torture round (multi-level partitioning, foreign
  tables, zero-column and 120-column tables, hostile identifiers, an
  unpopulated materialized view, FK exotics) found and fixed another
  batch:

  - Zero-column tables were invisible (the snapshot was built from column
    rows alone); foreign tables (FDW) were invisible too. Both now appear:
    foreign tables carry the new kind "foreign" and every writable code
    path treats them as read-only; the Database bridge lists them beside
    plain tables and pgtap asserts them with has_foreign_table.
  - An unpopulated materialized view or a failing foreign-table read
    aborted the whole generate run mid-verification; both now verify as
    skipped with a note.
  - A column literally named **proto** silently corrupted every generated
    schema (object literals set the prototype even for quoted keys) until
    a validator crashed; generation now refuses it loudly. A table named
    "index" silently lost its schema file to the barrel; that is now a
    loud error too.
  - Seed correctness: nullable foreign keys now order parents before
    children (soft edges, broken only on real cycles with those cells
    seeded null); FKs referencing a UNIQUE column instead of the primary
    key are refused with a named reason; free-text placeholders are only
    emitted for genuinely free-text base types (inet, cidr, interval and
    friends have constrained input syntax) and respect varchar/char
    length caps.
  - Trigger-returning functions no longer leak into the Functions block;
    dictionary cells escape pipes and newlines in comments; the schema
    card keeps multiline comments on one line. SUPAWATCH_DEBUG=1 prints
    stack traces on CLI errors.

## 0.7.1

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
