# @supawatch/target-schema-lock

## 0.14.0

### Patch Changes

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

### Patch Changes

- Updated dependencies [99797c6]
  - @supawatch/core@0.9.0

## 0.8.0

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
