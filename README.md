# supawatch

Validator schemas for Supabase-style Postgres projects that keep themselves in
sync. A DDL event trigger rings `pg_notify`, a watcher holding one read-only
LISTEN connection wakes, answers "what changed" by diffing catalog snapshots,
regenerates schemas from direct `pg_catalog` introspection, and proves every
schema by parsing real rows before anyone trusts it. No CLI to remember during
development, no connection string on the command line.

Phase 1 of the spec: Zod target, listen and manual sources, `init`, `generate`
and `watch` commands. See the spec artifact for the full plan (Valibot,
ArkType, TypeBox, PGlite-isolated verification, parity harness).

## Packages

| Package | Owns |
| --- | --- |
| `@supawatch/core` | Snapshot IR with driver-truth `RuntimeType`, introspection over a driver-neutral `Querier` seam, snapshot diff, atomic file sink, emit assembly. No runtime deps. |
| `@supawatch/target-zod` | The Zod target: renders from `RuntimeType` (numeric is a string, timestamptz is a Date), emits `.mjs` plus a typed `.d.mts` companion, and carries its own `Verifier`. |
| `@supawatch/watch` | The runtime: trigger sources (`listen` via postgres.js, `manual` for one-shots), debounce, the regenerate cycle, row verification. |
| `supawatch` | The CLI and the target registry (registry as data, five facts per target). Commands: `init`, `generate`, `watch`. |

## Try it

```
pnpm install
pnpm run test    # builds, then unit tests (PGlite, no Docker needed)
pnpm run e2e     # Docker Postgres 17 + pack-install-run consumer + live DDL
pnpm run gate    # both
```

The e2e is the honest one: it packs all four packages into tarballs, installs
them into an empty consumer project the way npm actually would, runs the
installed binary, applies live DDL (a new column, an enum value, a new table),
and asserts the watcher saw each change, regenerated, and passed ground-truth
checks against real rows.

## Design rules carried from the POC and drzl

- Targets render from what the driver returns at runtime, never from the SQL
  type name. The unit suite includes a must-fire negative control: numeric
  mapped as `z.number()` must be rejected against a real row, and is.
- Generated files are written atomically (temp then rename) because a
  concurrent reader of a truncate-and-write sees an empty module. Observed,
  not theoretical.
- Registry as data: kind, specifier, import thunk, constructor, output dir.
  A test asserts registry kinds equal the config enum kinds.
- Config is a discriminated union per target kind from day one.
- "Package not installed" and "target threw" are distinguishable errors.
- The connection comes from `DATABASE_URL` only, never argv or config.

## Status

0.1.0, private. Not published to npm; the `@supawatch` org and the OIDC
trusted-publisher setup are release-time work, and first publishes go out by
hand per the known OIDC constraint on brand-new packages.
