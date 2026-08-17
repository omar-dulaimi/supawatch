# Packages

Every `@supawatch/target-*` npm page carries its own focused README.

## Core

| Package | What it is |
| --- | --- |
| [`supawatch`](https://www.npmjs.com/package/supawatch) | The CLI and config. Start here. |
| [`@supawatch/core`](https://www.npmjs.com/package/@supawatch/core) | Snapshot IR, introspection, diff, runtime-type map. |
| [`@supawatch/watch`](https://www.npmjs.com/package/@supawatch/watch) | The watcher runtime and trigger sources, usable as a library. |
| [`@supawatch/verify`](https://www.npmjs.com/package/@supawatch/verify) | The ground-truth and parity harness. |

## Validation

| Package | What it emits |
| --- | --- |
| [`@supawatch/target-zod`](https://www.npmjs.com/package/@supawatch/target-zod) | Zod schemas with insert/update variants. |
| [`@supawatch/target-valibot`](https://www.npmjs.com/package/@supawatch/target-valibot) | Valibot schemas with insert/update variants. |
| [`@supawatch/target-arktype`](https://www.npmjs.com/package/@supawatch/target-arktype) | ArkType types with insert/update variants. |
| [`@supawatch/target-typebox`](https://www.npmjs.com/package/@supawatch/target-typebox) | TypeBox schemas with insert/update variants. |
| [`@supawatch/target-effect`](https://www.npmjs.com/package/@supawatch/target-effect) | Effect Schema structs with insert/update variants. |
| [`@supawatch/target-json-schema`](https://www.npmjs.com/package/@supawatch/target-json-schema) | Draft-07 JSON Schemas, Ajv-verified. |

## Types

| Package | What it emits |
| --- | --- |
| [`@supawatch/target-supabase-types`](https://www.npmjs.com/package/@supawatch/target-supabase-types) | The supabase-js `Database` interface: relationships and functions included. |
| [`@supawatch/target-realtime`](https://www.npmjs.com/package/@supawatch/target-realtime) | Typed realtime payload aliases under the measured wire profile. |

## API surfaces

| Package | What it emits |
| --- | --- |
| [`@supawatch/target-trpc`](https://www.npmjs.com/package/@supawatch/target-trpc) | tRPC routers wired to the generated schemas. |
| [`@supawatch/target-orpc`](https://www.npmjs.com/package/@supawatch/target-orpc) | oRPC routers with the same input validation. |
| [`@supawatch/target-rest`](https://www.npmjs.com/package/@supawatch/target-rest) | Hono route modules, mountable anywhere including Edge Functions. |
| [`@supawatch/target-service`](https://www.npmjs.com/package/@supawatch/target-service) | Typed repositories over postgres.js: list, findById, create, update, remove. |
| [`@supawatch/target-graphql`](https://www.npmjs.com/package/@supawatch/target-graphql) | An executable Pothos GraphQL schema typed by driver truth. |

These layers contain no authentication or authorisation. See
[SECURITY.md](../SECURITY.md).

## AI

| Package | What it emits |
| --- | --- |
| [`@supawatch/target-mcp`](https://www.npmjs.com/package/@supawatch/target-mcp) | A generated MCP server, list and get tools per table. |
| [`@supawatch/target-ai-tools`](https://www.npmjs.com/package/@supawatch/target-ai-tools) | Vercel AI SDK tool definitions. |
| [`@supawatch/target-schema-card`](https://www.npmjs.com/package/@supawatch/target-schema-card) | A token-lean schema card for LLM prompts. |

## Testing and data

| Package | What it emits |
| --- | --- |
| [`@supawatch/target-fast-check`](https://www.npmjs.com/package/@supawatch/target-fast-check) | Property-test arbitraries guaranteed to satisfy the Zod schemas. |
| [`@supawatch/target-factories`](https://www.npmjs.com/package/@supawatch/target-factories) | Typed fixture factories with the same guarantee. |
| [`@supawatch/target-seed`](https://www.npmjs.com/package/@supawatch/target-seed) | Deterministic FK-aware seed.sql with sequence resync. |
| [`@supawatch/target-pgtap`](https://www.npmjs.com/package/@supawatch/target-pgtap) | A plan-counted pgTAP structural suite, RLS assertions included. |

## Database

| Package | What it emits |
| --- | --- |
| [`@supawatch/target-rls`](https://www.npmjs.com/package/@supawatch/target-rls) | RLS policy skeletons for exactly the tables that need attention. |
| [`@supawatch/target-pgmq`](https://www.npmjs.com/package/@supawatch/target-pgmq) | Typed pgmq queue clients, one per detected queue. |
| [`@supawatch/target-schema-lock`](https://www.npmjs.com/package/@supawatch/target-schema-lock) | The committed canonical snapshot behind drift review. |

## Documentation and UI

| Package | What it emits |
| --- | --- |
| [`@supawatch/target-erd`](https://www.npmjs.com/package/@supawatch/target-erd) | A GitHub-rendered Mermaid ER diagram. |
| [`@supawatch/target-dictionary`](https://www.npmjs.com/package/@supawatch/target-dictionary) | A markdown data dictionary, comments sourced from Postgres. |
| [`@supawatch/target-forms`](https://www.npmjs.com/package/@supawatch/target-forms) | Framework-agnostic form field configs. |
