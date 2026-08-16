# @supawatch/target-erd

The ER-diagram target for
[supawatch](https://github.com/omar-dulaimi/supawatch). Emits
`schema.erd.md`: a Mermaid `erDiagram` inside a fenced block that GitHub
renders natively, with PK and FK markers and relationship edges built from
real foreign keys. Regenerated on every schema change, so the diagram stays
correct instead of correct-once.

Configure it in `supawatch.config.ts` (the CLI loads this package by name):

```ts
targets: [{ kind: "erd" }]
```

A nullable foreign key renders as an optional relationship. Views appear as
entities alongside tables.

MIT.
