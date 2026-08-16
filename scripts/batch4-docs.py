import pathlib

root = pathlib.Path(__file__).resolve().parent.parent

readmes = {
    "target-mcp": """# @supawatch/target-mcp

The MCP-server target for
[supawatch](https://github.com/omar-dulaimi/supawatch). Emits
`mcp-server.mjs`: a factory building an MCP server with list and get
tools per table, input-validated by the ALREADY-generated Zod schemas.
Every AI-adjacent team hand-writes exactly this against their database,
and theirs drifts; this one regenerates on every schema change.

```ts
targets: [
  { kind: "zod", strict: true },
  { kind: "mcp" },
]
```

```bash
npm install @modelcontextprotocol/sdk   # peer dependency
```

```js
import { createMcpServer } from "./src/schemas/mcp-server.mjs";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import postgres from "postgres";

const server = createMcpServer({ sql: postgres(process.env.DATABASE_URL) });
await server.connect(new StdioServerTransport());
```

Tools per table: `<table>_list` (bounded limit) and `<table>_get` for
single-column primary keys. The repo's suite drives a real MCP client
and server pair over the SDK's in-memory transport against real rows.

MIT.
""",
    "target-ai-tools": """# @supawatch/target-ai-tools

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
""",
}
for name, content in readmes.items():
    (root / "packages" / name / "README.md").write_text(content)
    print(name, "readme ok")

meta = root / "scripts" / "add-npm-meta.py"
s = meta.read_text()
if "target-mcp" not in s:
    s = s.replace(
        '    "verify": {',
        '''    "target-mcp": {
        "description": "A generated MCP server per database from supawatch: list and get tools per table, validated by the generated Zod schemas.",
        "keywords": BASE_KEYWORDS + ["mcp", "model-context-protocol", "ai", "agents"],
    },
    "target-ai-tools": {
        "description": "Vercel AI SDK tool definitions generated from live Postgres by supawatch, validated by the generated Zod schemas.",
        "keywords": BASE_KEYWORDS + ["ai-sdk", "vercel-ai", "tools", "agents"],
    },
    "verify": {''',
    )
    meta.write_text(s)
print("meta ok")
