# @supawatch/target-schema-card

The LLM schema-card target for
[supawatch](https://github.com/omar-dulaimi/supawatch). Emits
`schema-card.md`: a compact, token-lean schema summary (tables, key
columns, PK and FK markers, enums, comments) meant for system prompts and
agent context. Teams paste stale schema dumps into prompts today; this one
is small and regenerates on every schema change.

```ts
targets: [{ kind: "schema-card" }]
```

MIT.
