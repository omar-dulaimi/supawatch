import pathlib

root = pathlib.Path(__file__).resolve().parent.parent

readmes = {
    "target-forms": """# @supawatch/target-forms

The form-config target for
[supawatch](https://github.com/omar-dulaimi/supawatch). Emits one
framework-agnostic field-config array per table: control kind, label,
required flag, and options for enums, derived from the same insert
semantics as the validator variants. Server-owned columns (identity
always, generated) are excluded.

Configure it in `supawatch.config.ts` (the CLI loads this package by name):

```ts
targets: [{ kind: "forms" }]
```

```js
import { tasksFields } from "./src/schemas/forms/tasks.mjs";
// [{ name: "status", label: "Status", control: "select",
//    required: false, options: ["todo", "doing", "done", "archived"] }, ...]
```

Pair it with the zod target's insert variant as the resolver; the two are
derived from the same column facts and cannot disagree.

MIT.
""",
    "target-factories": """# @supawatch/target-factories

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
""",
    "target-trpc": """# @supawatch/target-trpc

The tRPC target for
[supawatch](https://github.com/omar-dulaimi/supawatch). Emits one router
factory per table with list, byId (single-column primary keys), and
create procedures, input-validated by the ALREADY-generated Zod schemas.

Requirements, stated up front: the zod target must run in the same config
with `emit: { insert: true }`, and the factory receives your own initTRPC
instance and postgres.js connection; this package adds no runtime
dependencies of its own.

```ts
targets: [
  { kind: "zod", strict: true, emit: { insert: true } },
  { kind: "trpc" },
]
```

```ts
import { initTRPC } from "@trpc/server";
import postgres from "postgres";
import { createTasksRouter } from "./src/schemas/trpc/tasks.mjs";

const t = initTRPC.create();
const sql = postgres(process.env.DATABASE_URL);
export const tasksRouter = createTasksRouter(t, sql);
```

`schemasImportPath` overrides the relative import to the zod output when
you relocate either target.

MIT.
""",
}
for name, content in readmes.items():
    (root / "packages" / name / "README.md").write_text(content)
    print(name, "readme ok")

meta = root / "scripts" / "add-npm-meta.py"
s = meta.read_text()
if "target-forms" not in s:
    s = s.replace(
        '    "verify": {',
        '''    "target-forms": {
        "description": "Framework-agnostic form field configs generated from live Postgres by supawatch: controls, labels, requiredness, enum options.",
        "keywords": BASE_KEYWORDS + ["forms", "react-hook-form", "tanstack-form"],
    },
    "target-factories": {
        "description": "Typed fixture factories generated from live Postgres by supawatch, guaranteed to satisfy the generated Zod schemas.",
        "keywords": BASE_KEYWORDS + ["fixtures", "factories", "testing"],
    },
    "target-trpc": {
        "description": "tRPC routers generated from live Postgres by supawatch, input-validated by the generated Zod schemas.",
        "keywords": BASE_KEYWORDS + ["trpc", "router", "api"],
    },
    "verify": {''',
    )
    meta.write_text(s)
print("meta ok")
