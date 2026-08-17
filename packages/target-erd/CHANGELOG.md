# @supawatch/target-erd

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

### Patch Changes

- @supawatch/core@0.13.0

## 0.12.0

### Patch Changes

- @supawatch/core@0.12.0

## 0.11.0

### Minor Changes

- d4057c0: Two ERD defects found by rendering diagrams to images instead of
  trusting that they parse.

  Relationship edges were dropped entirely: an entity-trimming guard keyed
  its lookups differently from the set it consulted, so every edge failed
  the check and the diagram rendered as boxes with no relationships, while
  parsing, size and alias assertions all still passed. One shared key
  function now serves every relation lookup, and the suite asserts the
  emitted edge count equals the schema's foreign-key count.

  Layout is now legible on large schemas: Mermaid lays entities that have
  no relationships out in a single endless row, so 40 entities rendered
  10000 pixels wide with an empty middle, and 356 rendered 102000 pixels
  wide. Past `maxIsolated` (default 10) those tables are omitted and
  counted in a note, and past `maxEntities` (default 60) the least
  connected go too, always keeping every edge between what remains. Both
  caps accept 0 to disable.

### Patch Changes

- @supawatch/core@0.11.0

## 0.10.0

### Minor Changes

- 63e8953: Large schemas produced a diagram Mermaid refuses to render. Mermaid caps
  diagram source at `maxTextSize` (its own default is 50000 characters) and
  substitutes a "Maximum text size in diagram exceeded" box; the check lives
  in the render path, so an oversized diagram parses cleanly and still cannot
  be displayed. The ERD target now keeps its output renderable: it emits every
  column when that fits, otherwise key columns only, otherwise relationships
  only, and states which it chose in a note above the diagram. New options
  `attributes` (`"all" | "keys" | "none"`) and `maxTextSize` make the choice
  explicit, with an honest warning when an explicit choice cannot render. The
  suite now asserts emitted size against the limit as well as parsing, since
  parsing alone never catches this.

### Patch Changes

- @supawatch/core@0.10.0

## 0.9.1

### Patch Changes

- fd4cae1: The ERD emitted raw identifiers into Mermaid, so a table or column name
  outside Mermaid's token grammar (spaces, semicolons, unicode, names
  starting with a digit) produced a diagram that fails to parse; and
  relationships resolved parents by bare table name, wiring the wrong
  entity when two schemas hold same-named tables. Entities now use a safe
  identifier with the real name as a quoted display alias, attributes
  sanitize their tokens and keep the real column name in the attribute
  comment, parents resolve by schema and name, and the suite now parses
  generated diagrams with real mermaid, hostile names included, with a
  must-fire control proving the checker detects broken output.
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
