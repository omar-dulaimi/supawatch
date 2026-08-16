# @supawatch/target-factories

The fixture-factory target for
[supawatch](https://github.com/omar-dulaimi/supawatch). Emits one typed
factory per table returning a full, deterministic row in driver shape,
with overrides merged on top.

Configure it in `supawatch.config.ts` (the CLI loads this package by name):

```ts
targets: [{ kind: "factories" }]
```

```ts
import { makeTasks } from "./src/schemas/factories/tasks.mjs";

const task = makeTasks({ title: "override just what the test cares about" });
```

The repo's suite asserts every factory's default row satisfies the
generated Zod schema for the same table, so factories cannot drift into
the narrow, wrong fixtures that hide bugs. That check has already caught
one: an invalid placeholder UUID.

MIT.
