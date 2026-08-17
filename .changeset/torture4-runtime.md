---
"supawatch": minor
"@supawatch/watch": minor
"@supawatch/target-fast-check": patch
"@supawatch/verify": patch
---

Torture round 4 attacked the runtime environment rather than the schema
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
