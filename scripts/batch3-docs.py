import pathlib

root = pathlib.Path(__file__).resolve().parent.parent

readmes = {
    "target-schema-card": """# @supawatch/target-schema-card

The LLM schema-card target for
[supawatch](https://github.com/omar-dulaimi/supawatch). Emits
`schema-card.md`: a compact, token-lean schema summary (tables, key
columns, PK and FK markers, enums, comments) meant for system prompts and
agent context. Teams paste stale schema dumps into prompts today; this one
is small and regenerates on every schema change.

```ts
targets: [{ kind: "schema-card" }]
```

MIT.
""",
    "target-dictionary": """# @supawatch/target-dictionary

The data-dictionary target for
[supawatch](https://github.com/omar-dulaimi/supawatch). Emits
`schema-dictionary.md`: per-table sections with SQL types, runtime types,
nullability, keys, identity and default markers, plus enums, domains and
composite types. Column and table comments come from Postgres itself
(`comment on ...`), so the database stays the single source of
documentation truth, and a comment change regenerates the file live.

```ts
targets: [{ kind: "dictionary" }]
```

MIT.
""",
    "target-realtime": """# @supawatch/target-realtime

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
""",
}
for name, content in readmes.items():
    (root / "packages" / name / "README.md").write_text(content)
    print(name, "readme ok")

meta = root / "scripts" / "add-npm-meta.py"
s = meta.read_text()
if "target-schema-card" not in s:
    s = s.replace(
        '    "verify": {',
        '''    "target-schema-card": {
        "description": "A compact, token-lean schema card generated from live Postgres by supawatch for LLM prompts and agent context.",
        "keywords": BASE_KEYWORDS + ["llm", "prompt", "context", "ai"],
    },
    "target-dictionary": {
        "description": "A markdown data dictionary generated from live Postgres by supawatch, comments sourced from the database itself.",
        "keywords": BASE_KEYWORDS + ["data-dictionary", "documentation", "comments"],
    },
    "target-realtime": {
        "description": "Typed supabase-js realtime payload aliases generated from live Postgres by supawatch, shaped by the measured wire profile.",
        "keywords": BASE_KEYWORDS + ["realtime", "supabase-js", "payloads"],
    },
    "verify": {''',
    )
    meta.write_text(s)
print("meta ok")
