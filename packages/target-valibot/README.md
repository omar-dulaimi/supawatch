# @supawatch/target-valibot

The Valibot target for
[supawatch](https://github.com/omar-dulaimi/supawatch). Renders one Valibot
schema per table from what the driver actually returns at runtime, plus a
typed `.d.mts` companion.

Configure it in `supawatch.config.ts` (the CLI loads this package by name):

```ts
targets: [{ kind: "valibot", strict: true }]
```

```bash
npm install valibot   # peer dependency, resolved from your project
```

Emitted shape:

```js
import * as v from "valibot";

export const tasksRow = v.strictObject({
  "id": v.string(),
  "status": v.picklist(["todo", "doing", "done", "archived"]),
  "estimate_hours": v.nullable(v.string()),
  "created_at": v.date(),
});
```

`strict` (default) uses `v.strictObject`. `emit: { insert, update }` adds
variants with `v.optional` on server-fillable columns and identity or
generated columns excluded.

Type mappings and their measured basis:
[main README](https://github.com/omar-dulaimi/supawatch#driver-profiles).

MIT.
