# @supawatch/target-json-schema

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
