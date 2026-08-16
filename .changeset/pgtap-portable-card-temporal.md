---
"@supawatch/target-pgtap": patch
"@supawatch/target-schema-card": patch
---

Two fixes found by inspecting real generated output. The pgtap suite
asserted RLS through `tests.rls_enabled`, a Supabase test-helpers
function that does not exist in core pgtap, contradicting the file's own
"run with pg_prove" claim; it now asserts straight off `pg_class` with
core `ok()`, so the suite runs under plain pg_prove and supabase test db
alike. The schema card labeled every temporal column `date` because both
`date` and `timestamptz` arrive as JS Date at runtime; an LLM reading
"date" plans calendar arithmetic, so temporal columns now keep their SQL
granularity (`date`, `timestamp`, `timestamptz`).
