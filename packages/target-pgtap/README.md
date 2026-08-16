# @supawatch/target-pgtap

The pgTAP target for
[supawatch](https://github.com/omar-dulaimi/supawatch). Emits
`structure.pgtap.sql`: a plan-counted structural test suite asserting
what your schema actually is. Per table: `has_table`, `has_column`,
null and not-null constraints, primary key and foreign key columns.
Tables with row level security enabled also get
`tests.rls_enabled` and `policies_are` with the exact policy names.

```ts
targets: [{ kind: "pgtap" }]
```

Run it with `pg_prove` or `supabase test db` against a database with
the pgtap extension installed. The `plan(N)` count is derived from the
emitted assertions, so a truncated file fails loudly instead of passing
quietly; the repo's suite locks that arithmetic.

Emission is tested against real introspected schemas. Executing the
suite needs pgtap in your database, which is on you.

MIT.
