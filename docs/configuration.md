# Configuration reference

Every field of `supawatch.config.ts`, with its default.

```ts
import { defineConfig } from "supawatch";

export default defineConfig({
  schemas: ["public"],
  outDir: "src/schemas",
  includeViews: true,        // view columns are all nullable; see limits.md
  barrel: true,              // index.mjs + index.d.mts per target dir
  profile: "postgres-js",    // or "supabase-js"; see driver-profiles.md
  jsonTypes: {               // optional: tighten DECLARED types of json columns
    "tasks.details": "{ reviewer?: string }",
  },
  source: { kind: "listen", debounceMs: 300 },  // or { kind: "poll" } | { kind: "manual" }
  targets: [{ kind: "zod", strict: true }],
});
```

## Sources

How the watcher learns that the schema moved.

| Source | Behaviour |
| --- | --- |
| `listen` | The event trigger fires `pg_notify`, the watcher reacts. Needs a direct or session-mode connection. |
| `poll` | Introspects on an interval and diffs. Works through transaction poolers. |
| `manual` | Regenerates only when you trigger it. For scripted use. |

## Target options

Every target accepts:

- `path` to override its output directory inside `outDir`.
- `strict` (default `true`) to reject unknown keys.
- `emit` to add insert and update variants. Identity and generated columns
  are excluded; server-fillable columns become optional.

```ts
targets: [
  { kind: "zod", strict: true, emit: { insert: true, update: true } },
  { kind: "seed", rows: 3 },
]
```

## Peer dependencies

Targets do not bundle the libraries they generate for. Install the ones
you use:

| Targets | Install |
| --- | --- |
| `zod` | `zod` |
| `valibot` | `valibot` |
| `arktype` | `arktype` |
| `typebox` | `@sinclair/typebox` |
| `effect` | `effect` |
| `rest` | `hono` |
| `trpc` | `@trpc/server` |
| `orpc` | `@orpc/server` |
| `graphql` | `@pothos/core` and `graphql` |

## The full target list

Every target is opt-in. See [packages.md](packages.md) for what each one
emits and a link to its README.

```ts
targets: [
  { kind: "zod" }, { kind: "valibot" }, { kind: "arktype" },
  { kind: "typebox" }, { kind: "effect" }, { kind: "json-schema" },
  { kind: "supabase-types" }, { kind: "realtime" },
  { kind: "trpc" }, { kind: "orpc" }, { kind: "rest" },
  { kind: "service" }, { kind: "graphql" },
  { kind: "mcp" }, { kind: "ai-tools" }, { kind: "schema-card" },
  { kind: "fast-check" }, { kind: "factories" }, { kind: "seed" },
  { kind: "pgtap" }, { kind: "rls" }, { kind: "pgmq" },
  { kind: "forms" }, { kind: "erd" }, { kind: "dictionary" },
  { kind: "schema-lock" },
]
```
