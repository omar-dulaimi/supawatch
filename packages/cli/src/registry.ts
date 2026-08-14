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
