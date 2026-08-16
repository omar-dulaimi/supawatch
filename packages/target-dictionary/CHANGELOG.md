# @supawatch/target-dictionary

## 0.9.0

### Patch Changes

- Updated dependencies [99797c6]
  - @supawatch/core@0.9.0

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
