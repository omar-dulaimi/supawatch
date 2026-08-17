# @supawatch/target-schema-lock

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
