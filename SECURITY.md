# Security

## Reporting a vulnerability

Report privately through GitHub's
[security advisories](https://github.com/omar-dulaimi/supawatch/security/advisories/new)
rather than a public issue. Expect an acknowledgement within a few days.
There is no bounty programme.

## What supawatch touches

It connects to your database and **reads the catalog**. It does not run
migrations, write to your tables, or send your schema anywhere. The only
writes it performs are the generated files in your configured `outDir`.

Worth knowing when you assess the risk:

- The connection string comes from `DATABASE_URL` in your environment or
  a local `.env`. Nothing else reads it, and it is never written into
  generated output.
- `supawatch init` writes a migration that creates an event trigger
  calling `pg_notify`. It carries no payload beyond a fixed string.
- Generated code embeds **identifiers** from your catalog at generation
  time, always quoted, and passes **values** as query parameters. A
  table named `users; drop table users--` and a column named `a"b` are
  covered by tests that execute the generated code against a real
  database.
- Generated write helpers validate input with the generated schemas
  first, so unknown keys are rejected before any SQL is built.

## Things that are your call, not ours

- The RLS policy skeletons are a worklist with deliberate `TODO`
  conditions. They are not a security model, and applying them
  unreviewed would be a mistake.
- The generated REST, service, tRPC, oRPC and GraphQL layers contain no
  authentication or authorisation. They assume you put your own in front
  of them.
- The generated MCP server exposes read tools over your tables. Point it
  only at a role whose visibility you are willing to expose to whatever
  client connects.
