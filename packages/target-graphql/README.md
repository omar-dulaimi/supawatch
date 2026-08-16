# @supawatch/target-graphql

The GraphQL target for
[supawatch](https://github.com/omar-dulaimi/supawatch). Emits
`graphql-schema.mjs`: a Pothos builder wiring one object type per table
and a list query field per table over postgres.js. Field types follow
driver truth: integers are `Int`, floats are `Float`, booleans are
`Boolean`, timestamps serialize to ISO strings, and everything else
(numerics, uuids, enums, json, arrays) is served as `String` so nothing
lies about precision.

```ts
targets: [{ kind: "graphql" }]
```

The factory takes your postgres.js connection and returns an executable
`GraphQLSchema`:

```ts
import { createGraphqlSchema } from "./generated/graphql-schema.mjs";
const schema = createGraphqlSchema(sql);
```

Built against `@pothos/core` 4.x and `graphql` 16. A deliberately thin
read-only starting point: no mutations, no pagination arguments, no
relation traversal. The repo's suite executes real queries against a
real database, in plain Node, the way a consumer runs it.

MIT.
