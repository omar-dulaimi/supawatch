# @supawatch/target-supabase-types

The `Database` interface target for
[supawatch](https://github.com/omar-dulaimi/supawatch). Emits a single
`database.types.ts` compatible with `@supabase/supabase-js` generics, so
generated validators and your Supabase client share one source of truth.

Configure it in `supawatch.config.ts` (the CLI loads this package by name):

```ts
targets: [{ kind: "supabase-types", path: "src" }]
```

Then:

```ts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types.js";

const client = createClient<Database>(url, key);
const { data } = await client.from("tasks").select("id, status");
// data[].status is "todo" | "doing" | "done" | "archived"
// data[].id is number (int8 over PostgREST JSON)
```

The interface carries Tables with `Row`, `Insert`, `Update` and
`Relationships` built from real foreign-key introspection, plus Views,
Enums and CompositeTypes. Types always follow the measured PostgREST JSON
profile: numeric and int8 as numbers, dates as strings, enum arrays as real
arrays.

> [!WARNING]
> int8 over PostgREST JSON loses precision past 2^53; this was measured,
> not assumed.

`Functions` is currently an empty placeholder.

MIT.
