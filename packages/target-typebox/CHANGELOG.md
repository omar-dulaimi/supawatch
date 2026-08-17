# @supawatch/target-typebox

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
