# @supawatch/target-ai-tools

## 0.5.0

### Patch Changes

- @supawatch/core@0.5.0

## 0.4.0

### Minor Changes

- bbdd431: AI surfaces on a new functions facet. Core introspects plain Postgres
  functions (args with defaults, return types, set-returning), the diff
  reports them, and the Database bridge's Functions placeholder is now
  filled for typed supabase-js rpc calls. The mcp target emits a generated
  MCP server with list and get tools per table, validated by the generated
  Zod schemas and proven over a real client and server pair. The ai-tools
  target emits Vercel AI SDK tool definitions on the same plan.

### Patch Changes

- Updated dependencies [21630d2]
- Updated dependencies [bbdd431]
  - @supawatch/core@0.4.0
