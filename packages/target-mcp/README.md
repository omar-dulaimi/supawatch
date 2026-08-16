# @supawatch/target-mcp

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
