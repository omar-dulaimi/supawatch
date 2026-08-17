# supawatch

## 0.14.1

### Patch Changes

- Updated dependencies [1cecc7c]
  - @supawatch/core@0.14.1
  - @supawatch/target-ai-tools@0.14.1
  - @supawatch/target-arktype@0.14.1
  - @supawatch/target-dictionary@0.14.1
  - @supawatch/target-effect@0.14.1
  - @supawatch/target-erd@0.14.1
  - @supawatch/target-factories@0.14.1
  - @supawatch/target-fast-check@0.14.1
  - @supawatch/target-forms@0.14.1
  - @supawatch/target-graphql@0.14.1
  - @supawatch/target-json-schema@0.14.1
  - @supawatch/target-mcp@0.14.1
  - @supawatch/target-orpc@0.14.1
  - @supawatch/target-pgmq@0.14.1
  - @supawatch/target-pgtap@0.14.1
  - @supawatch/target-realtime@0.14.1
  - @supawatch/target-rest@0.14.1
  - @supawatch/target-rls@0.14.1
  - @supawatch/target-schema-card@0.14.1
  - @supawatch/target-schema-lock@0.14.1
  - @supawatch/target-seed@0.14.1
  - @supawatch/target-service@0.14.1
  - @supawatch/target-supabase-types@0.14.1
  - @supawatch/target-trpc@0.14.1
  - @supawatch/target-typebox@0.14.1
  - @supawatch/target-valibot@0.14.1
  - @supawatch/target-zod@0.14.1
  - @supawatch/watch@0.14.1

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

- Updated dependencies [e4abf73]
  - @supawatch/watch@0.14.0
  - @supawatch/target-schema-lock@0.14.0
  - @supawatch/target-erd@0.14.0
  - @supawatch/core@0.14.0
  - @supawatch/target-ai-tools@0.14.0
  - @supawatch/target-arktype@0.14.0
  - @supawatch/target-dictionary@0.14.0
  - @supawatch/target-effect@0.14.0
  - @supawatch/target-factories@0.14.0
  - @supawatch/target-fast-check@0.14.0
  - @supawatch/target-forms@0.14.0
  - @supawatch/target-graphql@0.14.0
  - @supawatch/target-json-schema@0.14.0
  - @supawatch/target-mcp@0.14.0
  - @supawatch/target-orpc@0.14.0
  - @supawatch/target-pgmq@0.14.0
  - @supawatch/target-pgtap@0.14.0
  - @supawatch/target-realtime@0.14.0
  - @supawatch/target-rest@0.14.0
  - @supawatch/target-rls@0.14.0
  - @supawatch/target-schema-card@0.14.0
  - @supawatch/target-seed@0.14.0
  - @supawatch/target-service@0.14.0
  - @supawatch/target-supabase-types@0.14.0
  - @supawatch/target-trpc@0.14.0
  - @supawatch/target-typebox@0.14.0
  - @supawatch/target-valibot@0.14.0
  - @supawatch/target-zod@0.14.0

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

- Updated dependencies [e9c8d74]
  - @supawatch/watch@0.13.0
  - @supawatch/target-schema-lock@0.13.0
  - @supawatch/core@0.13.0
  - @supawatch/target-ai-tools@0.13.0
  - @supawatch/target-arktype@0.13.0
  - @supawatch/target-dictionary@0.13.0
  - @supawatch/target-effect@0.13.0
  - @supawatch/target-erd@0.13.0
  - @supawatch/target-factories@0.13.0
  - @supawatch/target-fast-check@0.13.0
  - @supawatch/target-forms@0.13.0
  - @supawatch/target-graphql@0.13.0
  - @supawatch/target-json-schema@0.13.0
  - @supawatch/target-mcp@0.13.0
  - @supawatch/target-orpc@0.13.0
  - @supawatch/target-pgmq@0.13.0
  - @supawatch/target-pgtap@0.13.0
  - @supawatch/target-realtime@0.13.0
  - @supawatch/target-rest@0.13.0
  - @supawatch/target-rls@0.13.0
  - @supawatch/target-schema-card@0.13.0
  - @supawatch/target-seed@0.13.0
  - @supawatch/target-service@0.13.0
  - @supawatch/target-supabase-types@0.13.0
  - @supawatch/target-trpc@0.13.0
  - @supawatch/target-typebox@0.13.0
  - @supawatch/target-valibot@0.13.0
  - @supawatch/target-zod@0.13.0

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

- Updated dependencies [878f7da]
  - @supawatch/watch@0.12.0
  - @supawatch/target-fast-check@0.12.0
  - @supawatch/core@0.12.0
  - @supawatch/target-ai-tools@0.12.0
  - @supawatch/target-arktype@0.12.0
  - @supawatch/target-dictionary@0.12.0
  - @supawatch/target-effect@0.12.0
  - @supawatch/target-erd@0.12.0
  - @supawatch/target-factories@0.12.0
  - @supawatch/target-forms@0.12.0
  - @supawatch/target-graphql@0.12.0
  - @supawatch/target-json-schema@0.12.0
  - @supawatch/target-mcp@0.12.0
  - @supawatch/target-orpc@0.12.0
  - @supawatch/target-pgmq@0.12.0
  - @supawatch/target-pgtap@0.12.0
  - @supawatch/target-realtime@0.12.0
  - @supawatch/target-rest@0.12.0
  - @supawatch/target-rls@0.12.0
  - @supawatch/target-schema-card@0.12.0
  - @supawatch/target-schema-lock@0.12.0
  - @supawatch/target-seed@0.12.0
  - @supawatch/target-service@0.12.0
  - @supawatch/target-supabase-types@0.12.0
  - @supawatch/target-trpc@0.12.0
  - @supawatch/target-typebox@0.12.0
  - @supawatch/target-valibot@0.12.0
  - @supawatch/target-zod@0.12.0

## 0.11.0

### Patch Changes

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

- Updated dependencies [d4057c0]
  - @supawatch/target-erd@0.11.0
  - @supawatch/core@0.11.0
  - @supawatch/target-ai-tools@0.11.0
  - @supawatch/target-arktype@0.11.0
  - @supawatch/target-dictionary@0.11.0
  - @supawatch/target-effect@0.11.0
  - @supawatch/target-factories@0.11.0
  - @supawatch/target-fast-check@0.11.0
  - @supawatch/target-forms@0.11.0
  - @supawatch/target-graphql@0.11.0
  - @supawatch/target-json-schema@0.11.0
  - @supawatch/target-mcp@0.11.0
  - @supawatch/target-orpc@0.11.0
  - @supawatch/target-pgmq@0.11.0
  - @supawatch/target-pgtap@0.11.0
  - @supawatch/target-realtime@0.11.0
  - @supawatch/target-rest@0.11.0
  - @supawatch/target-rls@0.11.0
  - @supawatch/target-schema-card@0.11.0
  - @supawatch/target-schema-lock@0.11.0
  - @supawatch/target-seed@0.11.0
  - @supawatch/target-service@0.11.0
  - @supawatch/target-supabase-types@0.11.0
  - @supawatch/target-trpc@0.11.0
  - @supawatch/target-typebox@0.11.0
  - @supawatch/target-valibot@0.11.0
  - @supawatch/target-zod@0.11.0
  - @supawatch/watch@0.11.0

## 0.10.0

### Patch Changes

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
- Updated dependencies [63e8953]
  - @supawatch/target-erd@0.10.0
  - @supawatch/core@0.10.0
  - @supawatch/target-ai-tools@0.10.0
  - @supawatch/target-arktype@0.10.0
  - @supawatch/target-dictionary@0.10.0
  - @supawatch/target-effect@0.10.0
  - @supawatch/target-factories@0.10.0
  - @supawatch/target-fast-check@0.10.0
  - @supawatch/target-forms@0.10.0
  - @supawatch/target-graphql@0.10.0
  - @supawatch/target-json-schema@0.10.0
  - @supawatch/target-mcp@0.10.0
  - @supawatch/target-orpc@0.10.0
  - @supawatch/target-pgmq@0.10.0
  - @supawatch/target-pgtap@0.10.0
  - @supawatch/target-realtime@0.10.0
  - @supawatch/target-rest@0.10.0
  - @supawatch/target-rls@0.10.0
  - @supawatch/target-schema-card@0.10.0
  - @supawatch/target-schema-lock@0.10.0
  - @supawatch/target-seed@0.10.0
  - @supawatch/target-service@0.10.0
  - @supawatch/target-supabase-types@0.10.0
  - @supawatch/target-trpc@0.10.0
  - @supawatch/target-typebox@0.10.0
  - @supawatch/target-valibot@0.10.0
  - @supawatch/target-zod@0.10.0
  - @supawatch/watch@0.10.0

## 0.9.1

### Patch Changes

- Updated dependencies [fd4cae1]
  - @supawatch/target-erd@0.9.1
  - @supawatch/core@0.9.1
  - @supawatch/target-ai-tools@0.9.1
  - @supawatch/target-arktype@0.9.1
  - @supawatch/target-dictionary@0.9.1
  - @supawatch/target-effect@0.9.1
  - @supawatch/target-factories@0.9.1
  - @supawatch/target-fast-check@0.9.1
  - @supawatch/target-forms@0.9.1
  - @supawatch/target-graphql@0.9.1
  - @supawatch/target-json-schema@0.9.1
  - @supawatch/target-mcp@0.9.1
  - @supawatch/target-orpc@0.9.1
  - @supawatch/target-pgmq@0.9.1
  - @supawatch/target-pgtap@0.9.1
  - @supawatch/target-realtime@0.9.1
  - @supawatch/target-rest@0.9.1
  - @supawatch/target-rls@0.9.1
  - @supawatch/target-schema-card@0.9.1
  - @supawatch/target-schema-lock@0.9.1
  - @supawatch/target-seed@0.9.1
  - @supawatch/target-service@0.9.1
  - @supawatch/target-supabase-types@0.9.1
  - @supawatch/target-trpc@0.9.1
  - @supawatch/target-typebox@0.9.1
  - @supawatch/target-valibot@0.9.1
  - @supawatch/target-zod@0.9.1
  - @supawatch/watch@0.9.1

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
  - @supawatch/watch@0.9.0
  - @supawatch/target-zod@0.9.0
  - @supawatch/target-valibot@0.9.0
  - @supawatch/target-arktype@0.9.0
  - @supawatch/target-typebox@0.9.0
  - @supawatch/target-effect@0.9.0
  - @supawatch/target-json-schema@0.9.0
  - @supawatch/target-fast-check@0.9.0
  - @supawatch/target-factories@0.9.0
  - @supawatch/target-realtime@0.9.0
  - @supawatch/target-supabase-types@0.9.0
  - @supawatch/target-seed@0.9.0
  - @supawatch/target-ai-tools@0.9.0
  - @supawatch/target-dictionary@0.9.0
  - @supawatch/target-erd@0.9.0
  - @supawatch/target-forms@0.9.0
  - @supawatch/target-graphql@0.9.0
  - @supawatch/target-mcp@0.9.0
  - @supawatch/target-orpc@0.9.0
  - @supawatch/target-pgmq@0.9.0
  - @supawatch/target-pgtap@0.9.0
  - @supawatch/target-rest@0.9.0
  - @supawatch/target-rls@0.9.0
  - @supawatch/target-schema-card@0.9.0
  - @supawatch/target-schema-lock@0.9.0
  - @supawatch/target-service@0.9.0
  - @supawatch/target-trpc@0.9.0

## 0.8.0

### Patch Changes

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

- Updated dependencies [c95d248]
- Updated dependencies [e3a62a0]
  - @supawatch/core@0.8.0
  - @supawatch/watch@0.8.0
  - @supawatch/target-supabase-types@0.8.0
  - @supawatch/target-zod@0.8.0
  - @supawatch/target-valibot@0.8.0
  - @supawatch/target-arktype@0.8.0
  - @supawatch/target-typebox@0.8.0
  - @supawatch/target-effect@0.8.0
  - @supawatch/target-json-schema@0.8.0
  - @supawatch/target-fast-check@0.8.0
  - @supawatch/target-factories@0.8.0
  - @supawatch/target-forms@0.8.0
  - @supawatch/target-trpc@0.8.0
  - @supawatch/target-orpc@0.8.0
  - @supawatch/target-rest@0.8.0
  - @supawatch/target-service@0.8.0
  - @supawatch/target-graphql@0.8.0
  - @supawatch/target-realtime@0.8.0
  - @supawatch/target-seed@0.8.0
  - @supawatch/target-pgtap@0.8.0
  - @supawatch/target-dictionary@0.8.0
  - @supawatch/target-schema-card@0.8.0
  - @supawatch/target-ai-tools@0.8.0
  - @supawatch/target-erd@0.8.0
  - @supawatch/target-mcp@0.8.0
  - @supawatch/target-pgmq@0.8.0
  - @supawatch/target-rls@0.8.0
  - @supawatch/target-schema-lock@0.8.0

## 0.7.1

### Patch Changes

- Updated dependencies [d0f303b]
  - @supawatch/target-pgtap@0.7.1
  - @supawatch/target-schema-card@0.7.1
  - @supawatch/core@0.7.1
  - @supawatch/target-ai-tools@0.7.1
  - @supawatch/target-arktype@0.7.1
  - @supawatch/target-dictionary@0.7.1
  - @supawatch/target-effect@0.7.1
  - @supawatch/target-erd@0.7.1
  - @supawatch/target-factories@0.7.1
  - @supawatch/target-fast-check@0.7.1
  - @supawatch/target-forms@0.7.1
  - @supawatch/target-graphql@0.7.1
  - @supawatch/target-json-schema@0.7.1
  - @supawatch/target-mcp@0.7.1
  - @supawatch/target-orpc@0.7.1
  - @supawatch/target-pgmq@0.7.1
  - @supawatch/target-realtime@0.7.1
  - @supawatch/target-rest@0.7.1
  - @supawatch/target-rls@0.7.1
  - @supawatch/target-schema-lock@0.7.1
  - @supawatch/target-seed@0.7.1
  - @supawatch/target-service@0.7.1
  - @supawatch/target-supabase-types@0.7.1
  - @supawatch/target-trpc@0.7.1
  - @supawatch/target-typebox@0.7.1
  - @supawatch/target-valibot@0.7.1
  - @supawatch/target-zod@0.7.1
  - @supawatch/watch@0.7.1

## 0.7.0

### Patch Changes

- Updated dependencies [9314a4a]
  - @supawatch/core@0.7.0
  - @supawatch/target-seed@0.7.0
  - @supawatch/target-ai-tools@0.7.0
  - @supawatch/target-arktype@0.7.0
  - @supawatch/target-dictionary@0.7.0
  - @supawatch/target-effect@0.7.0
  - @supawatch/target-erd@0.7.0
  - @supawatch/target-factories@0.7.0
  - @supawatch/target-fast-check@0.7.0
  - @supawatch/target-forms@0.7.0
  - @supawatch/target-graphql@0.7.0
  - @supawatch/target-json-schema@0.7.0
  - @supawatch/target-mcp@0.7.0
  - @supawatch/target-orpc@0.7.0
  - @supawatch/target-pgmq@0.7.0
  - @supawatch/target-pgtap@0.7.0
  - @supawatch/target-realtime@0.7.0
  - @supawatch/target-rest@0.7.0
  - @supawatch/target-rls@0.7.0
  - @supawatch/target-schema-card@0.7.0
  - @supawatch/target-schema-lock@0.7.0
  - @supawatch/target-service@0.7.0
  - @supawatch/target-supabase-types@0.7.0
  - @supawatch/target-trpc@0.7.0
  - @supawatch/target-typebox@0.7.0
  - @supawatch/target-valibot@0.7.0
  - @supawatch/target-zod@0.7.0
  - @supawatch/watch@0.7.0

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
