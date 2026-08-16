---
"@supawatch/core": minor
"@supawatch/watch": minor
"supawatch": patch
"@supawatch/target-zod": minor
"@supawatch/target-valibot": minor
"@supawatch/target-arktype": minor
"@supawatch/target-typebox": minor
"@supawatch/target-effect": patch
"@supawatch/target-json-schema": patch
"@supawatch/target-fast-check": patch
"@supawatch/target-factories": patch
"@supawatch/target-realtime": patch
"@supawatch/target-supabase-types": patch
"@supawatch/target-seed": patch
"@supawatch/verify": minor
---

Torture round 3: pathological values, degenerate types, hostile names,
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
