import pathlib

root = pathlib.Path(__file__).resolve().parent.parent

readmes = {
    "target-erd": """# @supawatch/target-erd

The ER-diagram target for
[supawatch](https://github.com/omar-dulaimi/supawatch). Emits
`schema.erd.md`: a Mermaid `erDiagram` inside a fenced block that GitHub
renders natively, with PK and FK markers and relationship edges built from
real foreign keys. Regenerated on every schema change, so the diagram stays
correct instead of correct-once.

Configure it in `supawatch.config.ts` (the CLI loads this package by name):

```ts
targets: [{ kind: "erd" }]
```

A nullable foreign key renders as an optional relationship. Views appear as
entities alongside tables.

MIT.
""",
    "target-schema-lock": """# @supawatch/target-schema-lock

The schema lockfile target for
[supawatch](https://github.com/omar-dulaimi/supawatch). Emits
`schema.lock.json`: a canonical, byte-stable snapshot of your schema meant
to be committed.

Configure it in `supawatch.config.ts` (the CLI loads this package by name):

```ts
targets: [{ kind: "schema-lock" }]
```

Why commit it: `supawatch check` then catches schema drift the same way it
catches stale generated files, and the lockfile's diff in a pull request IS
the schema changelog reviewers read. Ordering is canonicalized (sorted keys
and collections), so an unchanged schema produces identical bytes.

MIT.
""",
    "target-json-schema": """# @supawatch/target-json-schema

The JSON Schema target for
[supawatch](https://github.com/omar-dulaimi/supawatch). Emits one draft-07
schema per table describing the row as the driver returns it, for API docs,
cross-language validation, and anything else that speaks JSON Schema.

Configure it in `supawatch.config.ts` (the CLI loads this package by name):

```ts
targets: [{ kind: "json-schema", strict: true }]
```

`strict` (default) sets `additionalProperties: false`. The target carries
its own Ajv verifier, so generated schemas are ground-truth checked against
real rows like every validator target.

Honest limit: JSON Schema cannot express JS `Date` or `Uint8Array`
instances, so timestamp and bytea columns emit an accept-anything schema
with a `$comment` saying why. The alternative, claiming `string`, would
reject every real driver row.

MIT.
""",
    "target-fast-check": """# @supawatch/target-fast-check

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
""",
}
for name, content in readmes.items():
    (root / "packages" / name / "README.md").write_text(content)
    print(name, "readme ok")

meta = root / "scripts" / "add-npm-meta.py"
s = meta.read_text()
if "target-erd" not in s:
    s = s.replace(
        '    "verify": {',
        '''    "target-erd": {
        "description": "A Mermaid ER diagram generated from live Postgres by supawatch, kept current on every schema change.",
        "keywords": BASE_KEYWORDS + ["mermaid", "erd", "diagram", "documentation"],
    },
    "target-schema-lock": {
        "description": "A canonical committed schema lockfile from supawatch, turning pull-request diffs into schema changelogs.",
        "keywords": BASE_KEYWORDS + ["lockfile", "drift", "ci"],
    },
    "target-json-schema": {
        "description": "Draft-07 JSON Schemas generated from live Postgres by supawatch, Ajv-verified against real rows.",
        "keywords": BASE_KEYWORDS + ["json-schema", "ajv", "validation", "openapi"],
    },
    "target-fast-check": {
        "description": "fast-check arbitraries generated from live Postgres by supawatch, producing rows shaped like real driver output.",
        "keywords": BASE_KEYWORDS + ["fast-check", "property-testing", "fuzzing", "testing"],
    },
    "verify": {''',
    )
    meta.write_text(s)
print("meta script ok")
