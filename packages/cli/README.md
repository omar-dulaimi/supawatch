# supawatch

Your Postgres schema, compiled to everything: validators, types, API
layers, AI surfaces, tests, seeds and docs. A DDL event trigger tells the
watcher when the schema moved, so the output regenerates itself, and
every runnable artifact is verified against real rows. This package is
the CLI and config entry point.

```bash
npm install --save-dev supawatch
npm install zod   # peer of the zod target
npx supawatch init
```

`init` writes an event-trigger migration and a `supawatch.config.ts`. Apply
the migration, set `DATABASE_URL` (environment or `./.env`), then:

```bash
npx supawatch watch     # live regeneration during development
npx supawatch generate  # one shot, for CI or scripts
npx supawatch check     # CI drift gate, writes nothing, nonzero exit on drift
npx supawatch doctor    # verify connection, trigger, LISTEN round trip, targets
```

Targets are opt-in, one per thing you want generated. Full documentation,
configuration reference, driver profiles, and honest limits:
[github.com/omar-dulaimi/supawatch](https://github.com/omar-dulaimi/supawatch#readme).

MIT.
