# @supawatch/target-schema-lock

The schema lockfile target for
[supawatch](https://github.com/omar-dulaimi/supawatch). Emits
`schema.lock.json`: a canonical, byte-stable snapshot of your schema meant
to be committed.

Configure it in `supawatch.config.ts` (the CLI loads this package by name):

```ts
targets: [{ kind: "schema-lock" }]
```

Why commit it: `supawatch check` then catches schema drift the same way it
catches stale generated files, and the lockfile's diff in a pull request IS
the schema changelog reviewers read. Ordering is canonicalized (sorted keys
and collections), so an unchanged schema produces identical bytes.

MIT.
