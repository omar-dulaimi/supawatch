# @supawatch/target-dictionary

The data-dictionary target for
[supawatch](https://github.com/omar-dulaimi/supawatch). Emits
`schema-dictionary.md`: per-table sections with SQL types, runtime types,
nullability, keys, identity and default markers, plus enums, domains and
composite types. Column and table comments come from Postgres itself
(`comment on ...`), so the database stays the single source of
documentation truth, and a comment change regenerates the file live.

```ts
targets: [{ kind: "dictionary" }]
```

MIT.
