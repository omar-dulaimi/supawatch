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
// or, explicitly:
targets: [{ kind: "erd", attributes: "keys", maxTextSize: 50000 }]
```

A nullable foreign key renders as an optional relationship. Views appear as
entities alongside tables. Database identifiers are free-form while Mermaid
accepts only word-safe tokens, so entities carry a safe identifier plus the
real name as a quoted display alias, and sanitized column names keep the
original in the attribute comment.

## Large schemas

Two Mermaid behaviors make big schemas render badly, and this target
works around both by default, stating in a note whenever it trimmed
something.

Mermaid refuses to render a diagram whose source passes `maxTextSize`
(its own default is 50000 characters) and shows "Maximum text size in
diagram exceeded" instead. So the target emits every column when that
fits, otherwise key columns only, otherwise relationships only. Set
`attributes` (`"all" | "keys" | "none"`) to choose explicitly, and
`maxTextSize` to match a renderer configured with a larger limit.

Mermaid also lays entities that have no relationships out in a single
endless row, which stretches the canvas into an unreadable strip. Past
`maxIsolated` (default 10) those tables are omitted and counted, and past
`maxEntities` (default 60) the least connected go too. Every relationship
between the entities that remain is always drawn. Set either to 0 to
disable that cap.

MIT.
