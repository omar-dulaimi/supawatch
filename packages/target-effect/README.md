# @supawatch/target-effect

The Effect Schema target for
[supawatch](https://github.com/omar-dulaimi/supawatch). Emits one
`Schema.Struct` per table, mapped to what your driver actually returns:
numerics decode as strings under the postgres-js profile, timestamps as
`DateFromSelf`, uuids as `Schema.UUID`, bytea as
`Schema.instanceOf(Uint8Array)`, enums as unions of literals, nullable
columns as `NullOr`.

```ts
targets: [{ kind: "effect", strict: true }]
```

`strict` decodes with `onExcessProperty: "error"`. Insert and update
variants follow the same rules as the other validator targets.

Verified, not assumed: the repo's parity harness runs the emitted Effect
schemas as a fifth verdict beside Zod, Valibot, ArkType, and TypeBox
against rows from a real database, and any divergence must be recorded
in a must-fire ledger before the suite passes.

MIT.
