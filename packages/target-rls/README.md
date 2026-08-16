# @supawatch/target-rls

The RLS skeleton target for
[supawatch](https://github.com/omar-dulaimi/supawatch). Emits
`rls-skeletons.sql`: policy stubs for exactly the tables that need
attention. Tables with RLS disabled get an `enable row level security`
statement; tables with no policies get stubs shaped by column
heuristics: an owner column (`user_id`, `owner_id`, `created_by`, and
friends) produces select-own and write-own policies on
`(select auth.uid())`, a tenant column produces an isolation stub with
a TODO on the claim path, and no recognizable column produces an honest
TODO comment instead of an invented condition. Tables already covered
by policies are listed, never restubbed.

```ts
targets: [{ kind: "rls" }]
```

Copy stubs into a migration and finish them; the file is a worklist,
not a migration. The generator cannot know your authorization model and
does not pretend to.

Policy and RLS state come from live introspection (`pg_policies`,
`relrowsecurity`), and the watcher reports policy creates and drops in
its diff output as they happen.

MIT.
