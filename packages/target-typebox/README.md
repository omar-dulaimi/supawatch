# @supawatch/target-typebox

The TypeBox target for
[supawatch](https://github.com/omar-dulaimi/supawatch). Renders one TypeBox
schema per table from what the driver actually returns at runtime, plus a
typed `.d.mts` companion.

Configure it in `supawatch.config.ts` (the CLI loads this package by name):

```ts
targets: [{ kind: "typebox", strict: true }]
```

```bash
npm install @sinclair/typebox   # peer dependency, resolved from your project
```

Emitted shape:

```js
import { Type, TypeRegistry, Kind } from "@sinclair/typebox";

if (!TypeRegistry.Has("PgDate")) TypeRegistry.Set("PgDate", (_s, v) => v instanceof Date);

export const tasksRow = Type.Object({
  "id": Type.String(),
  "status": Type.Union([Type.Literal("todo"), Type.Literal("doing"), Type.Literal("done"), Type.Literal("archived")]),
  "estimate_hours": Type.Union([Type.String(), Type.Null()]),
  "created_at": Type.Unsafe({ [Kind]: "PgDate" }),
}, { additionalProperties: false });
```

Dates and floats validate through registered kinds (`PgDate`, `PgFloat`)
because the stock checks reject real driver output: `timestamp
'infinity'` arrives as an invalid `Date` instance, and float columns can
hold `NaN` and the infinities.

`strict` (default) sets `additionalProperties: false`. `uuid` columns stay
plain `Type.String()` on purpose: format validation would need a
consumer-populated `FormatRegistry`, and a schema that silently validates
nothing is worse than one that says string. `emit: { insert, update }` adds
variants using `Type.Optional`.

Type mappings and their measured basis:
[main README](https://github.com/omar-dulaimi/supawatch#driver-profiles).

MIT.
