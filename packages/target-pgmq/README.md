# @supawatch/target-pgmq

The pgmq target for
[supawatch](https://github.com/omar-dulaimi/supawatch). Emits
`pgmq-clients.mjs`: one typed client per queue, detected from the
`pgmq.q_<name>` tables the extension creates. Each client wraps the
extension's own SQL functions over your postgres.js connection:
`send`, `read`, `pop`, `archive`, `remove`.

```ts
// queues live in the pgmq schema, so include it
schemas: ["public", "pgmq"],
targets: [{ kind: "pgmq" }]
```

```ts
import { queues } from "./generated/pgmq-clients.mjs";
const jobs = queues.jobs(sql);
const msgId = await jobs.send({ kind: "resize", id: 42 });
const batch = await jobs.read({ vt: 30, qty: 5 });
```

With no queues detected the module says so in a comment and exports an
empty `queues` map rather than failing.

Honest limit, stated up front: emitted method bodies call `pgmq.*`
functions, so runtime behavior is only proven against a database with
the pgmq extension installed. Detection and emission are tested against
real introspected schemas; the repo's plain-Postgres harness cannot
execute the extension itself.

MIT.
