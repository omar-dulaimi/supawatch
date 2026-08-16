# @supawatch/target-dictionary

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
