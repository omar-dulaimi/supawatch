# @supawatch/target-orpc

The oRPC target for
[supawatch](https://github.com/omar-dulaimi/supawatch). Emits one oRPC
router per table: `list`, `byId` keyed by the primary key, and `create`
on tables, with inputs validated by the already generated Zod schemas
through `os.input()`. Each module exports a factory that takes your
postgres.js connection and returns the router, ready to serve or to
call in process with oRPC's `call()`.

```ts
targets: [
  { kind: "zod", strict: true, emit: { insert: true } },
  { kind: "orpc" },
]
```

Requires the zod target; `schemasImportPath` (default `"../zod"`)
points the emitted imports at it. API shapes verified empirically
against `@orpc/server` 1.x: invalid inputs reject with `ORPCError`
before the handler runs.

The repo's suite calls the emitted procedures against a real database,
valid and invalid inputs both.

MIT.
