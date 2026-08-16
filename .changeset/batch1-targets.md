---
"supawatch": minor
"@supawatch/core": minor
"@supawatch/target-zod": minor
"@supawatch/target-valibot": minor
"@supawatch/target-arktype": minor
"@supawatch/target-typebox": minor
"@supawatch/target-supabase-types": minor
"@supawatch/target-erd": minor
"@supawatch/target-schema-lock": minor
"@supawatch/target-json-schema": minor
"@supawatch/target-fast-check": minor
"@supawatch/watch": minor
"@supawatch/verify": minor
---

Four new targets. erd emits a GitHub-rendered Mermaid ER diagram with PK
and FK markers. schema-lock emits a canonical committed snapshot that
turns pull-request diffs into schema changelogs and lets check catch
schema drift. json-schema emits draft-07 schemas per table with an Ajv
verifier, ground-truth checked like every validator target. fast-check
emits arbitraries producing rows shaped like real driver output, with a
suite guarantee that every arbitrary satisfies the generated Zod schema.

Core now introspects primary keys (Table.primaryKey), and the Target
seam gained assembleFile for non-module outputs and a per-target barrel
opt-out.
