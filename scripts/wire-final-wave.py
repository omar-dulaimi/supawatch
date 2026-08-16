import pathlib

root = pathlib.Path(__file__).resolve().parent.parent

c = root / "packages/cli/src/config.ts"
s = c.read_text()
s = s.replace(
    '  "seed",\n] as const;',
    '  "seed",\n  "effect",\n  "rest",\n  "service",\n  "orpc",\n  "graphql",\n  "pgtap",\n  "rls",\n  "pgmq",\n] as const;',
)
s = s.replace(
    '  snapshotConfigFor("seed").extend({ rows: z.number().int().positive().max(1000).optional() }),\n]);',
    """  snapshotConfigFor("seed").extend({ rows: z.number().int().positive().max(1000).optional() }),
  targetConfigFor("effect"),
  targetConfigFor("rest").extend({ schemasImportPath: z.string().optional() }),
  targetConfigFor("service").extend({ schemasImportPath: z.string().optional() }),
  targetConfigFor("orpc").extend({ schemasImportPath: z.string().optional() }),
  snapshotConfigFor("graphql"),
  snapshotConfigFor("pgtap"),
  snapshotConfigFor("rls"),
  snapshotConfigFor("pgmq"),
]);""",
)
c.write_text(s)
print("config ok")

r = root / "packages/cli/src/registry.ts"
s = r.read_text()
entries = """  {
    kind: "effect",
    specifier: "@supawatch/target-effect",
    load: () => import("@supawatch/target-effect"),
    construct: (m) => new (m as { EffectTarget: new () => Target }).EffectTarget(),
    outputDir: (t, cfg) => t.path ?? path.join(cfg.outDir, "effect"),
  },
  {
    kind: "rest",
    specifier: "@supawatch/target-rest",
    load: () => import("@supawatch/target-rest"),
    construct: (m) => new (m as { RestTarget: new () => Target }).RestTarget(),
    outputDir: (t, cfg) => t.path ?? path.join(cfg.outDir, "rest"),
  },
  {
    kind: "service",
    specifier: "@supawatch/target-service",
    load: () => import("@supawatch/target-service"),
    construct: (m) =>
      new (m as { ServiceTarget: new () => Target }).ServiceTarget(),
    outputDir: (t, cfg) => t.path ?? path.join(cfg.outDir, "service"),
  },
  {
    kind: "orpc",
    specifier: "@supawatch/target-orpc",
    load: () => import("@supawatch/target-orpc"),
    construct: (m) => new (m as { OrpcTarget: new () => Target }).OrpcTarget(),
    outputDir: (t, cfg) => t.path ?? path.join(cfg.outDir, "orpc"),
  },
  {
    kind: "graphql",
    specifier: "@supawatch/target-graphql",
    load: () => import("@supawatch/target-graphql"),
    construct: (m) =>
      new (m as { GraphqlTarget: new () => Target }).GraphqlTarget(),
    outputDir: (t, cfg) => t.path ?? cfg.outDir,
  },
  {
    kind: "pgtap",
    specifier: "@supawatch/target-pgtap",
    load: () => import("@supawatch/target-pgtap"),
    construct: (m) => new (m as { PgtapTarget: new () => Target }).PgtapTarget(),
    outputDir: (t, cfg) => t.path ?? cfg.outDir,
  },
  {
    kind: "rls",
    specifier: "@supawatch/target-rls",
    load: () => import("@supawatch/target-rls"),
    construct: (m) => new (m as { RlsTarget: new () => Target }).RlsTarget(),
    outputDir: (t, cfg) => t.path ?? cfg.outDir,
  },
  {
    kind: "pgmq",
    specifier: "@supawatch/target-pgmq",
    load: () => import("@supawatch/target-pgmq"),
    construct: (m) => new (m as { PgmqTarget: new () => Target }).PgmqTarget(),
    outputDir: (t, cfg) => t.path ?? cfg.outDir,
  },
  {
    kind: "supabase-types","""
s = s.replace("""  {
    kind: "supabase-types",""", entries)
r.write_text(s)
print("registry ok")
