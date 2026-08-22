# @supawatch/watch

## 0.14.2

### Patch Changes

- @supawatch/core@0.14.2

## 0.14.1

### Patch Changes

- Updated dependencies [1cecc7c]
  - @supawatch/core@0.14.1

## 0.14.0

### Minor Changes

- e4abf73: Torture round 6 went after determinism and deployment reality, and
  found three defects including a severe regression from the previous
  round.

  supawatch could not connect through a connection pooler at all. Pinning
  driver settings as startup parameters is rejected outright by PgBouncer
  and Supavisor ("unsupported startup parameter: bytea_output"), which
  broke Supabase's pooled port, the connection method their serverless
  guidance recommends. Only pooler-safe parameters are sent now; the
  settings that cannot be forced are reported as a warning instead, so a
  corrupting environment is still named rather than silently trusted.

  The watcher looked perfectly healthy while being permanently deaf. A
  transaction-mode pooler accepts LISTEN and then never delivers, so
  `supawatch watch` sat there logging "idle, listening" forever and never
  saw a schema change. It now proves delivery on a separate self-test
  channel at startup, resolving as soon as the ping lands, and warns with
  the fix (a direct connection, or `source: { kind: "poll" }`) when
  nothing arrives.

  Committed files were ordered by locale. `schema.lock.json` and the ER
  diagram sorted with `localeCompare` and no explicit locale, so ICU
  decided: measured, `en-US` orders `A_b a-b ab ärger Zeta` while `sv-SE`
  puts `ärger` last. Both files are committed and byte-compared, so two
  developers with different `LANG`, or CI with a different ICU build,
  would see drift on an identical schema. Both now sort by code point.

  Verified clean in the same round: the generated ESM modules import on
  Node 18, 20, 22 and 24; the `.d.mts` companions give real types under
  `node10`, `node16`, `nodenext` and `bundler` resolution, each proven with
  a wrong-shape control; and polling works through a transaction pooler,
  the documented workaround for the LISTEN limitation.

### Patch Changes

- @supawatch/core@0.14.0

## 0.13.0

### Minor Changes

- e9c8d74: Torture round 5 went after portability, upgrades and long-lived
  connections, and found three defects.

  The watcher decoded values with stale type parsers. A driver learns its
  custom type parsers when it CONNECTS, and the watcher holds one
  connection for hours while migrations run, so an enum created after it
  started decoded as the raw literal `{ok,bad}` from then on while the
  schemas generated in the same cycle expected a real array: every later
  verification of that table was wrong. The watcher now reconnects its
  query connection when the catalog's custom types change, on a
  connection separate from the LISTEN one so notifications keep flowing.

  Generated file names could collide on a case insensitive filesystem.
  Postgres holds `Users`, `users` and `USERS` as three tables; on macOS
  and Windows their files are one file, so two schemas were silently
  overwritten and the barrel exported modules that no longer existed,
  while Linux CI stayed green. Generated files are committed and shared,
  so this now fails loudly like the other collision guards.

  Upgrading supawatch made `check` report schema drift that never
  happened. The lockfile records facets added since it was designed
  (table kind, RLS state, policies, domain constraints) but its format
  version never moved, so a committed lockfile from an older version read
  as stale generated output. The format is now 2, and `check` recognises a
  format difference and says to regenerate instead of blaming the schema.

  Verified clean in the same round: introspection, generation, seeds and
  ground truth across Postgres 13, 14, 15, 16 and 17, and crash
  resilience, where SIGKILL mid-regeneration left no truncated file and no
  dangling barrel entry, `check` reported the mixed directory, and a
  rerun healed it.

### Patch Changes

- @supawatch/core@0.13.0

## 0.12.0

### Minor Changes

- 878f7da: Torture round 4 attacked the runtime environment rather than the schema
  shape, and found five defects.

  Driver truth did not survive server settings. Measured against Postgres
  17: with `bytea_output=escape` an 8 byte value decoded to 1 wrong byte,
  and with `DateStyle=German` the date 2026-03-04 came back as 2026-04-02,
  both silently, and a database or role can force either on every
  connection with `alter database ... set`. supawatch now pins DateStyle,
  bytea_output and IntervalStyle on its own connections so what it reads
  and verifies is the truth, and `doctor` reports when the environment
  would corrupt a plain consumer connection, since the consumer's own
  driver is still exposed.

  A table the connecting role may introspect but not read aborted the
  entire run with "permission denied", writing nothing. pg_catalog is world
  readable, so this is routine for a restricted role. That table's
  verification is now skipped by name and the run completes.

  Verification reported `0/0 passed` for tables with no visible rows,
  which reads like success while proving nothing, including tables whose
  rows an RLS policy hides from the connecting role. Those now report
  "no rows visible, nothing verified". The wording lived in two places
  that had drifted; both now share one function.

  fast-check arbitraries generated values Postgres rejects outright, so
  they were not the realistic rows they claim to be: `int8` columns got
  unbounded bigints (76 digits observed) and temporal columns got dates in
  year 171958, which the wire protocol refuses. Both are now bounded, and
  the round trip (sample, insert, read back, validate) is exercised
  against a real database.

### Patch Changes

- @supawatch/core@0.12.0

## 0.11.0

### Patch Changes

- @supawatch/core@0.11.0

## 0.10.0

### Patch Changes

- @supawatch/core@0.10.0

## 0.9.1

### Patch Changes

- @supawatch/core@0.9.1

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

### Patch Changes

- Updated dependencies [99797c6]
  - @supawatch/core@0.9.0

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

### Patch Changes

- Updated dependencies [c95d248]
- Updated dependencies [e3a62a0]
  - @supawatch/core@0.8.0

## 0.7.1

### Patch Changes

- @supawatch/core@0.7.1

## 0.7.0

### Patch Changes

- Updated dependencies [9314a4a]
  - @supawatch/core@0.7.0

## 0.6.0

### Patch Changes

- Updated dependencies [0fbe207]
  - @supawatch/core@0.6.0

## 0.5.0

### Patch Changes

- @supawatch/core@0.5.0

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

### Patch Changes

- Updated dependencies [21630d2]
- Updated dependencies [bbdd431]
  - @supawatch/core@0.4.0

## 0.3.0

### Patch Changes

- @supawatch/core@0.3.0

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

## 0.1.3

### Patch Changes

- e650db3: Proper npm pages: every package now ships a focused README, a
  description, and keywords. No code changes.
- Updated dependencies [e650db3]
  - @supawatch/core@0.1.3

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
