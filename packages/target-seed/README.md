# @supawatch/target-seed

The seed target for
[supawatch](https://github.com/omar-dulaimi/supawatch). Emits `seed.sql`:
deterministic, FK-aware seed rows. Parents insert before children,
identity columns get explicit ids via `OVERRIDING SYSTEM VALUE`,
sequences are resynced with `setval`, enum labels are real, and the byte
output is stable for an unchanged schema, so the file diffs like code.

```ts
targets: [{ kind: "seed", rows: 3 }]
```

Drop the output at `supabase/seed.sql` and `supabase db reset` applies
it. The repo's suite proves the hard parts against a real empty
database: an identity-always bigint parent, a uuid parent, FK chains
with a nullable edge, and a post-seed insert that does not collide
because sequences were resynced. Seeded rows are ground-truth checked
against the generated Zod schemas.

Honest limits, emitted as comments rather than guesses: tables whose
required foreign keys form a cycle, multi-column foreign keys, and
required columns with no default whose types have no honest literal
(composites, unknown types) are skipped by name.

MIT.
