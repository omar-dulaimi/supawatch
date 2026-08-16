# @supawatch/target-service

The service layer target for
[supawatch](https://github.com/omar-dulaimi/supawatch). Emits one
repository per table over postgres.js: `list`, `findById`, `create`,
`update`, `remove`. Reads validate through the generated Zod row
schemas, writes parse their inputs through the insert and update
variants, and identifier lists are baked at generation time so nothing
reaches SQL text from user input.

```ts
targets: [
  { kind: "zod", strict: true, emit: { insert: true, update: true } },
  { kind: "service" },
]
```

Requires the zod target; `schemasImportPath` (default `"../zod"`) points
the emitted imports at it. Views get read methods only; tables without a
single-column primary key skip `findById`, `update`, and `remove`
rather than guessing.

The repo's suite drives a full create, update, remove round trip
against a real database, including rejection of invalid inputs.

MIT.
