import path from "node:path";
import { z } from "zod";

// One kind enum feeds the config parser and --only. A discriminated union
// per kind from day one, the direct fix for drzl's flat 27-kind object.
export const TARGET_KINDS = [
  "zod",
  "valibot",
  "arktype",
  "typebox",
  "supabase-types",
  "erd",
  "schema-lock",
  "json-schema",
  "fast-check",
  "forms",
  "factories",
  "trpc",
  "schema-card",
  "dictionary",
  "realtime",
] as const;

function targetConfigFor<K extends (typeof TARGET_KINDS)[number]>(kind: K) {
  return z.object({
    kind: z.literal(kind),
    path: z.string().optional(),
    strict: z.boolean().optional(),
    emit: z
      .object({
        insert: z.boolean().optional(),
        update: z.boolean().optional(),
      })
      .optional(),
  });
}

const SupabaseTypesConfig = z.object({
  kind: z.literal("supabase-types"),
  path: z.string().optional(),
});

function snapshotConfigFor<K extends (typeof TARGET_KINDS)[number]>(kind: K) {
  return z.object({ kind: z.literal(kind), path: z.string().optional() });
}

const TargetConfig = z.discriminatedUnion("kind", [
  targetConfigFor("zod"),
  targetConfigFor("valibot"),
  targetConfigFor("arktype"),
  targetConfigFor("typebox"),
  targetConfigFor("json-schema"),
  targetConfigFor("fast-check"),
  targetConfigFor("forms"),
  targetConfigFor("factories"),
  targetConfigFor("trpc").extend({ schemasImportPath: z.string().optional() }),
  SupabaseTypesConfig,
  snapshotConfigFor("erd"),
  snapshotConfigFor("schema-lock"),
  snapshotConfigFor("schema-card"),
  snapshotConfigFor("dictionary"),
  snapshotConfigFor("realtime"),
]);

const SourceConfig = z
  .discriminatedUnion("kind", [
    z.object({ kind: z.literal("listen"), debounceMs: z.number().int().positive().optional() }),
    z.object({ kind: z.literal("poll"), intervalMs: z.number().int().positive().optional() }),
    z.object({ kind: z.literal("manual") }),
  ])
  .default({ kind: "listen" });

export const ConfigSchema = z.object({
  schemas: z.array(z.string()).default(["public"]),
  outDir: z.string().default("src/schemas"),
  // Views are included by default; Postgres reports every view column
  // as nullable, so their schemas are all-nullable and say so.
  includeViews: z.boolean().default(true),
  barrel: z.boolean().default(true),
  // Which measured runtime profile schemas target: postgres-js (the
  // tagged-template driver) or supabase-js (PostgREST's JSON). Under
  // supabase-js, driver-row verification is skipped; the e2e verifies
  // that profile against real PostgREST responses.
  profile: z.enum(["postgres-js", "supabase-js"]).default("postgres-js"),
  // Tightens DECLARED types of json/jsonb columns in .d.mts companions,
  // keyed "table.column" or "schema.table.column". Runtime validation
  // stays unknown: the catalog cannot verify what it does not enforce.
  jsonTypes: z.record(z.string(), z.string()).optional(),
  source: SourceConfig,
  targets: z.array(TargetConfig).min(1),
});

export type SupawatchConfig = z.output<typeof ConfigSchema>;
export type TargetConfigItem = SupawatchConfig["targets"][number];

export function defineConfig(config: z.input<typeof ConfigSchema>): z.input<typeof ConfigSchema> {
  return config;
}

export async function loadConfig(cwd: string): Promise<SupawatchConfig> {
  const { createJiti } = await import("jiti");
  const jiti = createJiti(import.meta.url);
  const candidates = ["supawatch.config.ts", "supawatch.config.mjs", "supawatch.config.js"];
  for (const candidate of candidates) {
    const file = path.join(cwd, candidate);
    let mod: unknown;
    try {
      mod = await jiti.import(file);
    } catch (err) {
      if (isModuleNotFound(err, file)) continue;
      throw err;
    }
    const raw = (mod as { default?: unknown }).default ?? mod;
    return ConfigSchema.parse(raw);
  }
  throw new Error(
    `no supawatch.config.{ts,mjs,js} found in ${cwd}; run "supawatch init" first`,
  );
}

// "Not found" vs "threw" must stay distinguishable; the error code alone is
// ambiguous because a config importing a missing package throws the same
// code, so the message is matched against the quoted file path.
function isModuleNotFound(err: unknown, file: string): boolean {
  const e = err as { code?: string; message?: string };
  if (e.code !== "ERR_MODULE_NOT_FOUND" && e.code !== "MODULE_NOT_FOUND") return false;
  return (e.message ?? "").includes(file);
}
