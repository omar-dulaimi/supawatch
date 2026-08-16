import path from "node:path";
import type { Target } from "@supawatch/core";
import type { SupawatchConfig, TargetConfigItem } from "./config.js";

// Registry as data: five declared facts per target, nothing else anywhere.
// Default output dirs are stated here and only here.
export interface TargetEntry {
  readonly kind: TargetConfigItem["kind"];
  readonly specifier: string;
  readonly load: () => Promise<unknown>;
  readonly construct: (module: unknown) => Target;
  readonly outputDir: (t: TargetConfigItem, cfg: SupawatchConfig) => string;
}

export const TARGETS: readonly TargetEntry[] = [
  {
    kind: "zod",
    specifier: "@supawatch/target-zod",
    load: () => import("@supawatch/target-zod"),
    construct: (m) => new (m as { ZodTarget: new () => Target }).ZodTarget(),
    outputDir: (t, cfg) => t.path ?? path.join(cfg.outDir, "zod"),
  },
  {
    kind: "valibot",
    specifier: "@supawatch/target-valibot",
    load: () => import("@supawatch/target-valibot"),
    construct: (m) =>
      new (m as { ValibotTarget: new () => Target }).ValibotTarget(),
    outputDir: (t, cfg) => t.path ?? path.join(cfg.outDir, "valibot"),
  },
  {
    kind: "arktype",
    specifier: "@supawatch/target-arktype",
    load: () => import("@supawatch/target-arktype"),
    construct: (m) =>
      new (m as { ArktypeTarget: new () => Target }).ArktypeTarget(),
    outputDir: (t, cfg) => t.path ?? path.join(cfg.outDir, "arktype"),
  },
  {
    kind: "typebox",
    specifier: "@supawatch/target-typebox",
    load: () => import("@supawatch/target-typebox"),
    construct: (m) =>
      new (m as { TypeboxTarget: new () => Target }).TypeboxTarget(),
    outputDir: (t, cfg) => t.path ?? path.join(cfg.outDir, "typebox"),
  },
  {
    kind: "erd",
    specifier: "@supawatch/target-erd",
    load: () => import("@supawatch/target-erd"),
    construct: (m) => new (m as { ErdTarget: new () => Target }).ErdTarget(),
    outputDir: (t, cfg) => t.path ?? cfg.outDir,
  },
  {
    kind: "schema-lock",
    specifier: "@supawatch/target-schema-lock",
    load: () => import("@supawatch/target-schema-lock"),
    construct: (m) =>
      new (m as { SchemaLockTarget: new () => Target }).SchemaLockTarget(),
    outputDir: (t, cfg) => t.path ?? cfg.outDir,
  },
  {
    kind: "json-schema",
    specifier: "@supawatch/target-json-schema",
    load: () => import("@supawatch/target-json-schema"),
    construct: (m) =>
      new (m as { JsonSchemaTarget: new () => Target }).JsonSchemaTarget(),
    outputDir: (t, cfg) => t.path ?? path.join(cfg.outDir, "json-schema"),
  },
  {
    kind: "fast-check",
    specifier: "@supawatch/target-fast-check",
    load: () => import("@supawatch/target-fast-check"),
    construct: (m) =>
      new (m as { FastCheckTarget: new () => Target }).FastCheckTarget(),
    outputDir: (t, cfg) => t.path ?? path.join(cfg.outDir, "fast-check"),
  },
  {
    kind: "forms",
    specifier: "@supawatch/target-forms",
    load: () => import("@supawatch/target-forms"),
    construct: (m) => new (m as { FormsTarget: new () => Target }).FormsTarget(),
    outputDir: (t, cfg) => t.path ?? path.join(cfg.outDir, "forms"),
  },
  {
    kind: "factories",
    specifier: "@supawatch/target-factories",
    load: () => import("@supawatch/target-factories"),
    construct: (m) =>
      new (m as { FactoriesTarget: new () => Target }).FactoriesTarget(),
    outputDir: (t, cfg) => t.path ?? path.join(cfg.outDir, "factories"),
  },
  {
    kind: "trpc",
    specifier: "@supawatch/target-trpc",
    load: () => import("@supawatch/target-trpc"),
    construct: (m) => new (m as { TrpcTarget: new () => Target }).TrpcTarget(),
    outputDir: (t, cfg) => t.path ?? path.join(cfg.outDir, "trpc"),
  },
  {
    kind: "schema-card",
    specifier: "@supawatch/target-schema-card",
    load: () => import("@supawatch/target-schema-card"),
    construct: (m) =>
      new (m as { SchemaCardTarget: new () => Target }).SchemaCardTarget(),
    outputDir: (t, cfg) => t.path ?? cfg.outDir,
  },
  {
    kind: "dictionary",
    specifier: "@supawatch/target-dictionary",
    load: () => import("@supawatch/target-dictionary"),
    construct: (m) =>
      new (m as { DictionaryTarget: new () => Target }).DictionaryTarget(),
    outputDir: (t, cfg) => t.path ?? cfg.outDir,
  },
  {
    kind: "realtime",
    specifier: "@supawatch/target-realtime",
    load: () => import("@supawatch/target-realtime"),
    construct: (m) =>
      new (m as { RealtimeTarget: new () => Target }).RealtimeTarget(),
    outputDir: (t, cfg) => t.path ?? cfg.outDir,
  },
  {
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
    kind: "seed",
    specifier: "@supawatch/target-seed",
    load: () => import("@supawatch/target-seed"),
    construct: (m) => new (m as { SeedTarget: new () => Target }).SeedTarget(),
    outputDir: (t, cfg) => t.path ?? cfg.outDir,
  },
  {
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
    kind: "supabase-types",
    specifier: "@supawatch/target-supabase-types",
    load: () => import("@supawatch/target-supabase-types"),
    construct: (m) =>
      new (m as { SupabaseTypesTarget: new () => Target }).SupabaseTypesTarget(),
    outputDir: (t, cfg) => t.path ?? cfg.outDir,
  },
];

export function entryFor(kind: TargetConfigItem["kind"]): TargetEntry {
  const entry = TARGETS.find((t) => t.kind === kind);
  if (!entry) throw new Error(`unknown target kind: ${kind}`);
  return entry;
}

export async function loadTarget(entry: TargetEntry): Promise<Target> {
  let module: unknown;
  try {
    module = await entry.load();
  } catch (err) {
    if (isPackageMissing(err, entry.specifier)) {
      throw new Error(
        `target "${entry.kind}" needs ${entry.specifier}; install it first`,
      );
    }
    throw err;
  }
  return entry.construct(module);
}

function isPackageMissing(err: unknown, specifier: string): boolean {
  const e = err as { code?: string; message?: string };
  if (e.code !== "ERR_MODULE_NOT_FOUND") return false;
  return (e.message ?? "").includes(`'${specifier}'`);
}
