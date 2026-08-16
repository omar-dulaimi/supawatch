import { pathToFileURL } from "node:url";
import * as v from "valibot";
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

export interface ValibotTargetOptions extends TargetOptions {
  strict?: boolean;
}

function valibotExpr(runtime: RuntimeType): string {
  switch (runtime.kind) {
    case "number":
      // Floats can really be NaN (measured); v.number() rejects it,
      // while +-Infinity already passes.
      return runtime.integer
        ? "v.pipe(v.number(), v.integer())"
        : "v.union([v.number(), v.nan()])";
    case "string":
      return runtime.format === "uuid"
        ? "v.pipe(v.string(), v.uuid())"
        : "v.string()";
    case "boolean":
      return "v.boolean()";
    case "date":
      // Invalid Date instances are real driver output for timestamp
      // 'infinity' and BC values; v.date() rejects them.
      return "v.instance(Date)";
    case "bytes":
      return "v.instance(Uint8Array)";
    case "json":
    case "unknown":
      return "v.unknown()";
    case "array":
      return `v.array(${valibotExpr(runtime.element)})`;
    case "enum": {
      if (runtime.labels.length === 0) return "v.never()";
      const labels = runtime.labels.map((l) => JSON.stringify(l)).join(", ");
      return `v.picklist([${labels}])`;
    }
  }
}

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
      if (runtime.labels.length === 0) return "never";
      return runtime.labels.map((l) => JSON.stringify(l)).join(" | ");
  }
}

export function exportNameFor(table: Table, snapshot: Snapshot): string {
  return exportBaseName(table, snapshot) + "Row";
}

function baseNameFor(table: Table, snapshot: Snapshot): string {
  return exportBaseName(table, snapshot);
}

function fieldSchema(col: Column): string {
  const base = valibotExpr(col.runtime);
  return col.nullable ? `v.nullable(${base})` : base;
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
      if (optionalWhen(col)) s = `v.optional(${s})`;
      return `  ${JSON.stringify(col.name)}: ${s},`;
    })
    .join("\n");
  return `export const ${name} = ${ctor}({\n${fields}\n});`;
}

export class ValibotTarget implements Target<ValibotTargetOptions> {
  readonly name = "valibot";
  readonly fileExtension = ".mjs";
  readonly capabilities: TargetCapabilities = {
    strictObjects: true,
    brandedTypes: true,
    dateInstances: true,
  };

  renderTable(
    table: Table,
    snapshot: Snapshot,
    opts: ValibotTargetOptions,
  ): Rendered {
    const strict = opts.strict !== false;
    const ctor = strict ? "v.strictObject" : "v.object";
    const fields = table.columns
      .map((col) => `  ${JSON.stringify(col.name)}: ${fieldSchema(col)},`)
      .join("\n");
    const parts = [
      `export const ${exportNameFor(table, snapshot)} = ${ctor}({\n${fields}\n});`,
    ];
    if (opts.emit?.insert && table.kind === "table") {
      parts.push(variantBody(table, ctor, `${baseNameFor(table, snapshot)}Insert`, insertOptional));
    }
    if (opts.emit?.update && table.kind === "table") {
      parts.push(variantBody(table, ctor, `${baseNameFor(table, snapshot)}Update`, () => true));
    }
    return {
      imports: [{ from: "valibot", namespace: "v" }],
      body: parts.join("\n\n"),
      exportName: exportNameFor(table, snapshot),
    };
  }

  renderTypes(table: Table, snapshot: Snapshot, opts: ValibotTargetOptions): string {
    const name = exportNameFor(table, snapshot);
    const base = baseNameFor(table, snapshot);
    const rowType = `${base}RowType`;
    const typeOf = (col: Column) => {
      const override = jsonOverrideFor(table, col, opts.jsonTypes);
      const b = override ?? tsType(col.runtime);
      return col.nullable && b !== "unknown" ? `${b} | null` : b;
    };
    const fields = table.columns
      .map((col) => `  ${JSON.stringify(col.name)}: ${typeOf(col)};`)
      .join("\n");
    const lines = [
      "// Generated by supawatch. Do not edit.",
      'import type { GenericSchema } from "valibot";',
      "",
      `export type ${rowType} = {`,
      fields,
      "};",
      `export declare const ${name}: GenericSchema<unknown, ${rowType}>;`,
    ];
    const variantTypes = (
      typeName: string,
      exportName: string,
      optionalWhen: (col: Column) => boolean,
    ) => {
      const vf = writableColumns(table)
        .map((col) => {
          const opt = optionalWhen(col) ? "?" : "";
          return `  ${JSON.stringify(col.name)}${opt}: ${typeOf(col)};`;
        })
        .join("\n");
      lines.push("", `export type ${typeName} = {`, vf, "};");
      lines.push(
        `export declare const ${exportName}: GenericSchema<unknown, ${typeName}>;`,
      );
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
        // Uses this package's own valibot to run a schema built by the
        // consumer's copy; safe within the same major.
        const r = v.safeParse(schema as v.GenericSchema, value);
        if (r.success) return { ok: true };
        return { ok: false, reason: r.issues[0]?.message };
      },
    };
  }
}

export default ValibotTarget;
