# @supawatch/target-arktype

The ArkType target for
[supawatch](https://github.com/omar-dulaimi/supawatch). Renders one ArkType
type per table from what the driver actually returns at runtime, plus a
typed `.d.mts` companion.

Configure it in `supawatch.config.ts` (the CLI loads this package by name):

```ts
targets: [{ kind: "arktype", strict: true }]
```

```bash
npm install arktype   # peer dependency, resolved from your project
```

Emitted shape:

```js
import { type } from "arktype";

export const tasksRow = type({
  "+": "reject",
  "id": "string",
  "status": "'todo'|'doing'|'done'|'archived'",
  "estimate_hours": "string|null",
  "created_at": "Date",
});
```

`strict` (default) adds the `"+": "reject"` undeclared-key marker. `bytea`
columns render as a `type.instanceOf(Uint8Array)` expression rather than a
DSL keyword. `emit: { insert, update }` adds variants using ArkType's
`"key?"` optional syntax.

Type mappings and their measured basis:
[main README](https://github.com/omar-dulaimi/supawatch#driver-profiles).

MIT.
