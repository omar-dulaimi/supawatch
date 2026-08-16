# @supawatch/target-trpc

The tRPC target for
[supawatch](https://github.com/omar-dulaimi/supawatch). Emits one router
factory per table with list, byId (single-column primary keys), and
create procedures, input-validated by the ALREADY-generated Zod schemas.

Requirements, stated up front: the zod target must run in the same config
with `emit: { insert: true }`, and the factory receives your own initTRPC
instance and postgres.js connection; this package adds no runtime
dependencies of its own.

```ts
targets: [
  { kind: "zod", strict: true, emit: { insert: true } },
  { kind: "trpc" },
]
```

```ts
import { initTRPC } from "@trpc/server";
import postgres from "postgres";
import { createTasksRouter } from "./src/schemas/trpc/tasks.mjs";

const t = initTRPC.create();
const sql = postgres(process.env.DATABASE_URL);
export const tasksRouter = createTasksRouter(t, sql);
```

`schemasImportPath` overrides the relative import to the zod output when
you relocate either target.

MIT.
