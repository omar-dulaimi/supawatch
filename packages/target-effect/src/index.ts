import { Schema } from "effect";
import { pathToFileURL } from "node:url";
import type {
  Column,
  Rendered,
  RuntimeType,
  Snapshot,
  Table,
  Target,
  TargetCapabilities,
  TargetOptions,
  Verdict,
  Verifier,
} from "@supawatch/core";
import { exportBaseName, fileBaseName } from "@supawatch/core";

// The Effect Schema target: one Schema.Struct per table from driver
// truth. The verifier decodes with onExcessProperty error, so strict
// semantics match the other validator targets and it joins the parity
// harness as a fifth verdict. API shapes verified empirically against
// effect 3.22 before anything here was written.

export interface EffectTargetOptions extends TargetOptions {
  strict?: boolean;
}

function effectExpr(runtime: RuntimeType): string {
  switch (runtime.kind) {
    case "number":
      // Effect has Schema.Int, but it brands; plain Number keeps parity
      // semantics aligned with z.number().int() via the filter below.
      return runtime.integer
        ? "Schema.Number.pipe(Schema.int())"
        : "Schema.Number";
    case "string":
      return runtime.format === "uuid" ? "Schema.UUID" : "Schema.String";
    case "boolean":
      return "Schema.Boolean";
    case "date":
      return "Schema.DateFromSelf";
    case "bytes":
      return "Schema.instanceOf(Uint8Array)";
    case "json":
    case "unknown":
      return "Schema.Unknown";
    case "array":
      return `Schema.Array(${effectExpr(runtime.element)})`;
    case "enum": {
      if (runtime.labels.length === 0) return "Schema.Never";
      const literals = runtime.labels
        .map((l) => `Schema.Literal(${JSON.stringify(l)})`)
        .join(", ");
      return `Schema.Union(${literals})`;
    }
  }
}

export function exportNameFor(table: Table, snapshot: Snapshot): string {
  return exportBaseName(table, snapshot) + "Row";
}

function fieldSchema(col: Column): string {
  const base = effectExpr(col.runtime);
  if (col.nullable && col.runtime.kind !== "unknown" && col.runtime.kind !== "json") {
    return `Schema.NullOr(${base})`;
  }
  return base;
}

export class EffectTarget implements Target<EffectTargetOptions> {
  readonly name = "effect";
  readonly fileExtension = ".mjs";
  readonly capabilities: TargetCapabilities = {
    strictObjects: true,
    brandedTypes: true,
    dateInstances: true,
  };

  renderTable(table: Table, snapshot: Snapshot, _opts: EffectTargetOptions): Rendered {
    const fields = table.columns
      .map((col) => `  ${JSON.stringify(col.name)}: ${fieldSchema(col)},`)
      .join("\n");
    return {
      imports: [{ from: "effect", names: ["Schema"] }],
      body: `export const ${exportNameFor(table, snapshot)} = Schema.Struct({\n${fields}\n});`,
      exportName: exportNameFor(table, snapshot),
    };
  }

  verifier(): Verifier {
    return {
      async load(file: string, exportName: string): Promise<unknown> {
        const url = pathToFileURL(file).href + `?v=${Date.now()}`;
        const mod = (await import(url)) as Record<string, unknown>;
        const schema = mod[exportName];
        if (!schema) {
          throw new Error(
            `no export ${exportName} in ${file}; exports: ${Object.keys(mod).join(",")}`,
          );
        }
        return Schema.decodeUnknownEither(schema as Schema.Schema<unknown>, {
          onExcessProperty: "error",
        });
      },
      check(decoder: unknown, value: unknown): Verdict {
        const decode = decoder as (v: unknown) => {
          _tag: "Left" | "Right";
          left?: { message?: string };
        };
        const result = decode(value);
        if (result._tag === "Right") return { ok: true };
        return { ok: false, reason: String(result.left?.message ?? "invalid").slice(0, 200) };
      },
    };
  }
}

export default EffectTarget;
