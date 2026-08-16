# @supawatch/target-zod

The Zod target for [supawatch](https://github.com/omar-dulaimi/supawatch).
Renders one Zod schema per table from what the driver actually returns at
runtime, plus a typed `.d.mts` companion for strict TypeScript.

Configure it in `supawatch.config.ts` (the CLI loads this package by name):

```ts
targets: [{ kind: "zod", strict: true, emit: { insert: true, update: true } }]
```

```bash
npm install zod   # peer dependency, resolved from your project
```

Emitted for a `tasks` table with a bigint id, an enum, and a numeric column:

```js
import { z } from "zod";

export const tasksRow = z.strictObject({
  "id": z.string(),
  "status": z.enum(["todo", "doing", "done", "archived"]),
  "estimate_hours": z.string().nullable(),
  "created_at": z.instanceof(Date),
});
```

`strict` (default) uses `z.strictObject`, so an unknown key fails. `emit`
adds `tasksInsert` and `tasksUpdate` variants: identity and generated
columns are excluded, server-fillable columns become `.optional()`.

Type mappings and their measured basis:
[main README](https://github.com/omar-dulaimi/supawatch#driver-profiles).

MIT.
