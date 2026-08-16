# @supawatch/target-rest

The REST target for
[supawatch](https://github.com/omar-dulaimi/supawatch). Emits one Hono
route module per table: `GET /` list, `GET /:id` when the table has a
single-column primary key, and `POST /` on tables, validated by the
already generated Zod schemas. Each module exports a factory that takes
your postgres.js connection and returns a `Hono` app to mount wherever
you like, including a Supabase Edge Function body.

```ts
targets: [
  { kind: "zod", strict: true, emit: { insert: true } },
  { kind: "rest" },
]
```

Requires the zod target; `schemasImportPath` (default `"../zod"`) points
the emitted imports at it. Identifiers are baked at generation time and
request values only travel as parameters. Invalid `POST` bodies return
400 with the first issue; valid ones return the inserted row as 201.

The repo's suite runs the emitted routes with `app.request()` against a
real database, and the end-to-end gate does the same against Dockerized
Postgres through packed tarballs.

MIT.
