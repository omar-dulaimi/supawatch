---
"@supawatch/target-seed": patch
---

The seed target no longer guesses at domain-typed columns. A base-type
placeholder can violate a domain's CHECK constraint (which the snapshot
does not record) and make the whole seed.sql fail to apply. Nullable and
defaulted domain columns are now omitted so the database fills them;
tables that require a domain value, or whose primary key is a domain,
are skipped with a comment naming the reason. Found by dogfooding
against a database with `create domain ... check (value like '%@%')`.
