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
