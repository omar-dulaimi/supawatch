# @supawatch/target-ai-tools

The Vercel AI SDK target for
[supawatch](https://github.com/omar-dulaimi/supawatch). Emits
`ai-tools.mjs`: `tool()` definitions per table, list and get, with input
schemas reused from the generated Zod target.

```ts
targets: [
  { kind: "zod", strict: true },
  { kind: "ai-tools" },
]
```

```bash
npm install ai   # peer dependency, v5
```

```js
import { generateText } from "ai";
import postgres from "postgres";
import { createAiTools } from "./src/schemas/ai-tools.mjs";

const sql = postgres(process.env.DATABASE_URL);
const { text } = await generateText({
  model,
  tools: createAiTools({ sql }),
  prompt: "How many open tasks are there?",
});
```

MIT.
