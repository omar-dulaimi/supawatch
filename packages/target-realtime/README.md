# @supawatch/target-realtime

The realtime-payload target for
[supawatch](https://github.com/omar-dulaimi/supawatch). Emits
`realtime.types.ts`: per-table `RealtimePostgresChangesPayload` aliases
whose row shapes follow the MEASURED PostgREST JSON wire profile (numeric
and int8 as numbers, dates as strings, enum arrays as real arrays),
closing the gap where realtime-js's own payload typing does not match the
wire.

```ts
targets: [{ kind: "realtime" }]
```

```ts
import type { TasksChanges } from "./src/schemas/realtime.types.js";

channel.on("postgres_changes", { event: "*", schema: "public", table: "tasks" },
  (payload: TasksChanges) => {
    if (payload.eventType === "INSERT") console.log(payload.new.status);
  });
```

Types only; views are excluded since they are not change sources. Needs
`@supabase/supabase-js` in your project for the payload generic.

MIT.
