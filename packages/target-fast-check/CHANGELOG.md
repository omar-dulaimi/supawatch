# @supawatch/target-fast-check

## 0.14.2

### Patch Changes

- @supawatch/core@0.14.2

## 0.14.1

### Patch Changes

- Updated dependencies [1cecc7c]
  - @supawatch/core@0.14.1

## 0.14.0

### Patch Changes

- @supawatch/core@0.14.0

## 0.13.0

### Patch Changes

- @supawatch/core@0.13.0

## 0.12.0

### Patch Changes

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

### Patch Changes

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

- Updated dependencies [99797c6]
  - @supawatch/core@0.9.0

## 0.8.0

### Patch Changes

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
