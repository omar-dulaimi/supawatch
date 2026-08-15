---
"supawatch": patch
"@supawatch/core": patch
"@supawatch/target-zod": patch
"@supawatch/target-valibot": patch
"@supawatch/target-arktype": patch
"@supawatch/target-typebox": patch
"@supawatch/target-supabase-types": patch
"@supawatch/watch": patch
"@supawatch/verify": patch
---

Two fixes found by dogfooding the published packages in a fresh consumer
project. The barrel now ships an index.d.mts beside index.mjs, because a
strict TypeScript consumer cannot type barrel imports without it. And
DATABASE_URL falls back to a minimal ./.env read (flat file, no
expansion) when the variable is not exported, which is how real projects
keep it.
