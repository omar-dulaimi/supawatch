import pathlib

root = pathlib.Path(__file__).resolve().parent.parent

c = root / "packages/cli/src/config.ts"
s = c.read_text()
s = s.replace(
    '  "schema-card",\n  "dictionary",\n  "realtime",\n] as const;',
    '  "schema-card",\n  "dictionary",\n  "realtime",\n  "mcp",\n  "ai-tools",\n] as const;',
)
s = s.replace(
    '  snapshotConfigFor("schema-card"),\n  snapshotConfigFor("dictionary"),\n  snapshotConfigFor("realtime"),\n]);',
    '  snapshotConfigFor("schema-card"),\n  snapshotConfigFor("dictionary"),\n  snapshotConfigFor("realtime"),\n  snapshotConfigFor("mcp").extend({ schemasImportPath: z.string().optional() }),\n  snapshotConfigFor("ai-tools").extend({ schemasImportPath: z.string().optional() }),\n]);',
)
c.write_text(s)
print("config ok")

r = root / "packages/cli/src/registry.ts"
s = r.read_text()
s = s.replace(
    """  {
    kind: "supabase-types",""",
    """  {
    kind: "mcp",
    specifier: "@supawatch/target-mcp",
    load: () => import("@supawatch/target-mcp"),
    construct: (m) => new (m as { McpTarget: new () => Target }).McpTarget(),
    outputDir: (t, cfg) => t.path ?? cfg.outDir,
  },
  {
    kind: "ai-tools",
    specifier: "@supawatch/target-ai-tools",
    load: () => import("@supawatch/target-ai-tools"),
    construct: (m) =>
      new (m as { AiToolsTarget: new () => Target }).AiToolsTarget(),
    outputDir: (t, cfg) => t.path ?? cfg.outDir,
  },
  {
    kind: "supabase-types",""",
)
r.write_text(s)
print("registry ok")
