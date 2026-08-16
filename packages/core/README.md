# @supawatch/core

The shared core of [supawatch](https://github.com/omar-dulaimi/supawatch):
the snapshot IR, catalog introspection, snapshot diffing, and the measured
runtime-type map. No opinions about output formats and no driver dependency.

Most users want the [`supawatch`](https://www.npmjs.com/package/supawatch)
CLI instead; this package is for building on the IR directly.

```bash
npm install @supawatch/core
```

Introspection runs over a minimal `Querier` seam, so any Postgres client
adapts in a few lines:

```ts
import { introspect, diff } from "@supawatch/core";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL);
const query = async (text, params) => sql.unsafe(text, params ?? []);

const snapshot = await introspect(query, ["public"]);
// snapshot.tables[].columns[].runtime is what the DRIVER returns:
// numeric -> string, timestamptz -> Date, int8 -> string, and so on.

const later = await introspect(query, ["public"]);
console.log(diff(snapshot, later)); // ["public.tasks gained note (text, nullable)"]
```

The `RuntimeType` on every column follows one of two measured driver
profiles (`postgres-js` or `supabase-js`); see the
[main README](https://github.com/omar-dulaimi/supawatch#driver-profiles).
The IR also carries enums, domains resolved to their base types, composite
types with fields, views (marked, all-nullable), foreign keys, and
identity/generated column flags.

MIT.
