---
"@supawatch/target-erd": patch
"@supawatch/verify": patch
---

The ERD emitted raw identifiers into Mermaid, so a table or column name
outside Mermaid's token grammar (spaces, semicolons, unicode, names
starting with a digit) produced a diagram that fails to parse; and
relationships resolved parents by bare table name, wiring the wrong
entity when two schemas hold same-named tables. Entities now use a safe
identifier with the real name as a quoted display alias, attributes
sanitize their tokens and keep the real column name in the attribute
comment, parents resolve by schema and name, and the suite now parses
generated diagrams with real mermaid, hostile names included, with a
must-fire control proving the checker detects broken output.
