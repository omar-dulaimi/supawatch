# @supawatch/watch

The watcher runtime of
[supawatch](https://github.com/omar-dulaimi/supawatch), usable as a library
inside your own dev process instead of the CLI.

```bash
npm install @supawatch/watch @supawatch/target-zod zod postgres
```

```ts
import postgres from "postgres";
import { Watcher, listenSource, querierFrom } from "@supawatch/watch";
import { ZodTarget } from "@supawatch/target-zod";

const sql = postgres(process.env.DATABASE_URL);
const watcher = new Watcher({
  query: querierFrom(sql),
  targets: [{ target: new ZodTarget(), options: { strict: true }, outDir: "src/schemas/zod" }],
  source: listenSource(sql),
});
await watcher.start();
```

Trigger sources: `listenSource` (the event-trigger LISTEN path, wakes on
reconnect too), `pollSource` (snapshot hashing where the trigger cannot be
installed), and `manualSource` (one-shot; what `supawatch generate` uses).
Every cycle introspects, diffs, regenerates atomically, prunes files for
dropped tables, and verifies generated schemas against real rows.

The LISTEN connection needs a direct or session-mode connection;
transaction-mode poolers do not carry LISTEN.

MIT.
