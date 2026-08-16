# @supawatch/target-fast-check

The fast-check target for
[supawatch](https://github.com/omar-dulaimi/supawatch). Emits one
`Arbitrary` per table producing rows shaped exactly like driver output:
enum labels real, numerics as decimal strings, bigints as strings, dates as
`Date` instances, nullable columns via `fc.option`.

Configure it in `supawatch.config.ts` (the CLI loads this package by name):

```ts
targets: [{ kind: "fast-check" }]
```

```bash
npm install --save-dev fast-check   # peer dependency
```

```ts
import fc from "fast-check";
import { tasksArb } from "./src/schemas/fast-check/tasks.mjs";

fc.assert(fc.property(tasksArb, (row) => myLogic(row) !== undefined));
```

The repo's own suite asserts every generated arbitrary satisfies the
generated Zod schema for the same table, so the two targets cannot drift
apart silently.

MIT.
