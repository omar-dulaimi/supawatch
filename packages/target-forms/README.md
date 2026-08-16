# @supawatch/target-forms

The form-config target for
[supawatch](https://github.com/omar-dulaimi/supawatch). Emits one
framework-agnostic field-config array per table: control kind, label,
required flag, and options for enums, derived from the same insert
semantics as the validator variants. Server-owned columns (identity
always, generated) are excluded.

Configure it in `supawatch.config.ts` (the CLI loads this package by name):

```ts
targets: [{ kind: "forms" }]
```

```js
import { tasksFields } from "./src/schemas/forms/tasks.mjs";
// [{ name: "status", label: "Status", control: "select",
//    required: false, options: ["todo", "doing", "done", "archived"] }, ...]
```

Pair it with the zod target's insert variant as the resolver; the two are
derived from the same column facts and cannot disagree.

MIT.
