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

export interface ZodTargetOptions extends TargetOptions {
  strict?: boolean;
}

function zodExpr(runtime: RuntimeType): string {
  switch (runtime.kind) {
    case "number":
      return runtime.integer ? "z.number().int()" : "z.number()";
    case "string":
      return runtime.format === "uuid" ? "z.uuid()" : "z.string()";
    case "boolean":
      return "z.boolean()";
    case "date":
      return "z.date()";
    case "bytes":
      return "z.instanceof(Uint8Array)"; // Buffer is a Uint8Array subclass
    case "json":
    case "unknown":
      return "z.unknown()";
    case "array":
      return `z.array(${zodExpr(runtime.element)})`;
    case "enum": {
      const labels = runtime.labels.map((l) => JSON.stringify(l)).join(", ");
      return `z.enum([${labels}])`;
    }
  }
}

// The TypeScript type the driver-truth runtime implies, for the .d.mts.
function tsType(runtime: RuntimeType): string {
  switch (runtime.kind) {
    case "number":
      return "number";
    case "string":
      return "string";
    case "boolean":
      return "boolean";
    case "date":
      return "Date";
    case "bytes":
      return "Uint8Array";
    case "json":
    case "unknown":
      return "unknown";
    case "array": {
      const el = tsType(runtime.element);
      return el.includes("|") ? `(${el})[]` : `${el}[]`;
    }
    case "enum":
      return runtime.labels.map((l) => JSON.stringify(l)).join(" | ");
  }
}

export function exportNameFor(table: Table): string {
  return table.name.replace(/[^a-zA-Z0-9_]/g, "_") + "Row";
}

function baseNameFor(table: Table): string {
  return table.name.replace(/[^a-zA-Z0-9_]/g, "_");
}

function fieldSchema(col: Column): string {
  let s = zodExpr(col.runtime);
  if (col.nullable) s += ".nullable()";
  return s;
}

function fieldType(col: Column, override?: string): string {
  const base = override ?? tsType(col.runtime);
  // unknown already absorbs null; adding the union is noise.
  if (col.nullable && base !== "unknown") return `${base} | null`;
  return base;
}

function jsonOverrideFor(
  table: Table,
  col: Column,
  jsonTypes?: Record<string, string>,
): string | undefined {
  if (!jsonTypes || col.runtime.kind !== "json") return undefined;
  return (
    jsonTypes[`${table.schema}.${table.name}.${col.name}`] ??
    jsonTypes[`${table.name}.${col.name}`]
  );
}

// Insert: server-owned columns (generated, identity always) are excluded;
// a column is optional when the server can fill it in. Update: the same
// exclusions, everything else optional.
function writableColumns(table: Table): Column[] {
  return table.columns.filter((c) => !c.generated && c.identity !== "always");
}

function insertOptional(col: Column): boolean {
  return col.hasDefault || col.nullable || col.identity === "default";
}

function variantBody(
  table: Table,
  ctor: string,
  name: string,
  optionalWhen: (col: Column) => boolean,
): string {
  const fields = writableColumns(table)
    .map((col) => {
      let s = fieldSchema(col);
      if (optionalWhen(col)) s += ".optional()";
      return `  ${JSON.stringify(col.name)}: ${s},`;
    })
    .join("\n");
  return `export const ${name} = ${ctor}({\n${fields}\n});`;
}

export class ZodTarget implements Target<ZodTargetOptions> {
  readonly name = "zod";
  readonly fileExtension = ".mjs";
  readonly capabilities: TargetCapabilities = {
    strictObjects: true,
    brandedTypes: true,
    dateInstances: true,
  };

  renderTable(table: Table, _snapshot: Snapshot, opts: ZodTargetOptions): Rendered {
    const strict = opts.strict !== false;
    const ctor = strict ? "z.strictObject" : "z.object";
    const fields = table.columns
      .map((col) => `  ${JSON.stringify(col.name)}: ${fieldSchema(col)},`)
      .join("\n");
    const parts = [
      `export const ${exportNameFor(table)} = ${ctor}({\n${fields}\n});`,
    ];
    if (opts.emit?.insert && table.kind === "table") {
      parts.push(variantBody(table, ctor, `${baseNameFor(table)}Insert`, insertOptional));
    }
    if (opts.emit?.update && table.kind === "table") {
      parts.push(variantBody(table, ctor, `${baseNameFor(table)}Update`, () => true));
    }
    return {
      imports: [{ from: "zod", names: ["z"] }],
      body: parts.join("\n\n"),
      exportName: exportNameFor(table),
    };
  }

  // Companion .d.mts so consumers get a typed parse and a Row type even
  // though the runtime artifact is plain JavaScript.
  renderTypes(table: Table, _snapshot: Snapshot, opts: ZodTargetOptions): string {
    const name = exportNameFor(table);
    const base = baseNameFor(table);
    const rowType = `${base}RowType`;
    const fields = table.columns
      .map((col) => {
        const override = jsonOverrideFor(table, col, opts.jsonTypes);
        return `  ${JSON.stringify(col.name)}: ${fieldType(col, override)};`;
      })
      .join("\n");
    const lines = [
      "// Generated by supawatch. Do not edit.",
      'import { z } from "zod";',
      "",
      `export type ${rowType} = {`,
      fields,
      "};",
      `export declare const ${name}: z.ZodType<${rowType}>;`,
    ];
    const variantTypes = (
      typeName: string,
      exportName: string,
      optionalWhen: (col: Column) => boolean,
    ) => {
      const vf = writableColumns(table)
        .map((col) => {
          const override = jsonOverrideFor(table, col, opts.jsonTypes);
          const opt = optionalWhen(col) ? "?" : "";
          return `  ${JSON.stringify(col.name)}${opt}: ${fieldType(col, override)};`;
        })
        .join("\n");
      lines.push("", `export type ${typeName} = {`, vf, "};");
      lines.push(`export declare const ${exportName}: z.ZodType<${typeName}>;`);
    };
    if (opts.emit?.insert && table.kind === "table") {
      variantTypes(`${base}InsertType`, `${base}Insert`, insertOptional);
    }
    if (opts.emit?.update && table.kind === "table") {
      variantTypes(`${base}UpdateType`, `${base}Update`, () => true);
    }
    lines.push("");
    return lines.join("\n");
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
        return schema;
      },
      check(schema: unknown, value: unknown): Verdict {
        const s = schema as {
          safeParse(v: unknown): {
            success: boolean;
            error?: { issues: { message: string }[] };
          };
        };
        const r = s.safeParse(value);
        if (r.success) return { ok: true };
        return { ok: false, reason: r.error?.issues[0]?.message };
      },
    };
  }
}

export default ZodTarget;
