---
"@supawatch/core": minor
"@supawatch/target-seed": patch
---

Domains now carry `hasConstraints` in the snapshot: true when the
domain, or any domain in its base chain, has a CHECK constraint or NOT
NULL. The seed target uses it to stop guessing: a base-type placeholder
for a constrained domain can violate its CHECK and make the whole
seed.sql fail to apply (found by dogfooding). Constrained domain columns
are now omitted when nullable or defaulted and skip their table with a
named reason when required; unconstrained domains seed as their base
type, unchanged. Skips also cascade: a table whose required foreign key
references an unseeded table is skipped too, so the emitted file always
applies. Committed schema.lock.json files gain the new domain field on
first regenerate after upgrading; `supawatch generate` heals the
one-time drift.
