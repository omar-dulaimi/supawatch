---
"@supawatch/core": minor
"@supawatch/watch": minor
"supawatch": patch
"@supawatch/target-seed": patch
"@supawatch/target-supabase-types": patch
"@supawatch/target-pgtap": patch
"@supawatch/target-dictionary": patch
"@supawatch/target-schema-card": patch
---

A second, harsher torture round (multi-level partitioning, foreign
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
- A column literally named __proto__ silently corrupted every generated
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
