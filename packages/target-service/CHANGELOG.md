# @supawatch/target-service

## 0.9.0

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
