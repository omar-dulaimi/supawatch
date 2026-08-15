# supawatch

Validator schemas for Supabase-style Postgres projects that keep themselves in
sync. A DDL event trigger rings `pg_notify`, a watcher holding one read-only
LISTEN connection wakes, answers "what changed" by diffing catalog snapshots,
regenerates schemas from direct `pg_catalog` introspection, and proves every
schema by parsing real rows before anyone trusts it. No CLI to remember during
development, no connection string on the command line.

All four spec phases are in: four validator targets (Zod, Valibot, ArkType,
TypeBox), listen, poll and manual sources, the PGlite verification harness
with cross-target parity and an ALLOWED ledger, facets for domains,
composites and views, and the `init`, `generate`, `watch`, `check` and
`doctor` commands.

## Packages

| Package | Owns |
| --- | --- |
| `@supawatch/core` | Snapshot IR with driver-truth `RuntimeType`, introspection over a driver-neutral `Querier` seam (tables, views, enums, domains, composites), snapshot diff, atomic file sink, emit assembly. |
| `@supawatch/target-zod` | The Zod target: renders from `RuntimeType` (numeric is a string, timestamptz is a Date), emits `.mjs` plus a typed `.d.mts` companion, and carries its own `Verifier`. |
| `@supawatch/target-valibot` | The same contract for Valibot. |
| `@supawatch/target-arktype` | The same contract for ArkType; renders field-position DSL strings only. |
| `@supawatch/target-typebox` | The same contract for TypeBox; uuid stays a plain string because format validation would need a consumer-populated FormatRegistry. |
| `@supawatch/target-supabase-types` | Snapshot-level target emitting a supabase-js-compatible Database interface (Tables with Row/Insert/Update/Relationships, Views, Enums, CompositeTypes), typed under the measured PostgREST profile. |
| `@supawatch/verify` | The PGlite harness: a fixture exercising every runtime-map row, ground truth on real rows, synthetic negatives, cross-target parity by verdicts, and the ALLOWED ledger whose entries fail the run when they stop firing. |
| `@supawatch/watch` | The runtime: trigger sources (`listen` via postgres.js, `poll` by snapshot hash, `manual` for one-shots), debounce, the regenerate cycle, row verification. |
| `supawatch` | The CLI and the target registry (registry as data, five facts per target). Commands: `init`, `generate`, `watch`, `check`, `doctor`. |

## Two driver profiles, both measured

`profile: "postgres-js"` (default) targets the tagged-template driver the
watcher itself uses. `profile: "supabase-js"` targets PostgREST's JSON,
measured live against postgrest/postgrest: numeric and int8 arrive as JSON
numbers (int8 loses precision past 2^53; the probe watched
9007199254740993 arrive as 9007199254740992), timestamps and dates arrive
as strings, bytea as a hex-escaped string, and enum arrays as real arrays
where both native drivers return the raw literal. Under the supabase-js
profile the watcher skips driver-row verification (its rows come from
postgres.js and would rightly fail); the e2e instead validates generated
schemas against a real PostgREST's responses.

## Facet semantics, measured not assumed

- A **domain** column behaves exactly as its base type at the driver level,
  including a domain over a domain, so its schema is the base type's schema.
- A **composite** column arrives from the driver as its raw row literal, for
  example `"(EUR,950)"`. Its schema is a string; a nested object schema
  would fail ground truth against real rows.
- **Views** are included by default (`includeViews: false` to opt out).
  Postgres reports every view column as nullable regardless of the
  underlying column, so view schemas are all-nullable, and the table's
  `kind: "view"` marker says why.

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

## Running against Supabase

Validated against the real Supabase Postgres image (supabase start,
postgres 17.6): the `postgres` role there is NOT a superuser
(`rolsuper = f`), supautils is loaded via session_preload_libraries, and
`create event trigger` succeeded as that role. `supawatch doctor` passed
all checks against it, including a live LISTEN/NOTIFY round trip, and
`generate` ground-truthed real rows. The remaining caveat is that this was
the local image, not hosted infrastructure; the privilege model tested is
the one hosted Supabase documents.

- `supawatch init` writes the event-trigger migration into
  `supabase/migrations/` so it ships with every environment.
- The watcher's LISTEN connection must be a direct connection (port 5432)
  or a session-mode pool. LISTEN does not survive a transaction-mode pooler
  (Supavisor port 6543), where the backing connection changes per statement.
- Supabase-managed schemas (`auth`, `storage`) stay out of `schemas` unless
  deliberately added; their migrations are Supabase's, not yours.

## Status

0.1.0, unpublished, MIT licensed. All four spec phases implemented; versions
are managed by changesets from here on. Not yet on npm; the `@supawatch` org
registration and the first publish are manual steps (OIDC trusted publishing
cannot publish a brand-new package), documented in RELEASING.md.
