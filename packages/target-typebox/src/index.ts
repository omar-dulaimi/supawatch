import { pathToFileURL } from "node:url";
import { Value } from "@sinclair/typebox/value";
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
import type { TSchema } from "@sinclair/typebox";

export interface TypeboxTargetOptions extends TargetOptions {
  strict?: boolean;
}

// uuid stays a plain Type.String: TypeBox format validation needs a
// FormatRegistry the consumer would have to populate, and a schema that
// silently validates nothing is worse than one that says string.
function typeboxExpr(runtime: RuntimeType): string {
  switch (runtime.kind) {
    case "number":
      return runtime.integer ? "Type.Integer()" : "Type.Number()";
    case "string":
      return "Type.String()";
    case "boolean":
      return "Type.Boolean()";
    case "date":
      return "Type.Date()";
    case "bytes":
      return "Type.Uint8Array()";
    case "json":
    case "unknown":
      return "Type.Unknown()";
    case "array":
      return `Type.Array(${typeboxExpr(runtime.element)})`;
    case "enum": {
      const literals = runtime.labels
        .map((l) => `Type.Literal(${JSON.stringify(l)})`)
        .join(", ");
      return `Type.Union([${literals}])`;
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
  const base = typeboxExpr(col.runtime);
  if (col.nullable && col.runtime.kind !== "unknown" && col.runtime.kind !== "json") {
    return `Type.Union([${base}, Type.Null()])`;
  }
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

function writableColumns(table: Table): Column[] {
  return table.columns.filter((c) => !c.generated && c.identity !== "always");
}

function insertOptional(col: Column): boolean {
  return col.hasDefault || col.nullable || col.identity === "default";
}

function variantBody(
  table: Table,
  strict: boolean,
  name: string,
  optionalWhen: (col: Column) => boolean,
): string {
  const fields = writableColumns(table)
    .map((col) => {
      let s = fieldSchema(col);
      if (optionalWhen(col)) s = `Type.Optional(${s})`;
      return `  ${JSON.stringify(col.name)}: ${s},`;
    })
    .join("\n");
  const tail = strict ? `, { additionalProperties: false }` : "";
  return `export const ${name} = Type.Object({\n${fields}\n}${tail});`;
}

export class TypeboxTarget implements Target<TypeboxTargetOptions> {
  readonly name = "typebox";
  readonly fileExtension = ".mjs";
  readonly capabilities: TargetCapabilities = {
    strictObjects: true,
    brandedTypes: false,
    dateInstances: true,
  };

  renderTable(
    table: Table,
    snapshot: Snapshot,
    opts: TypeboxTargetOptions,
  ): Rendered {
    const strict = opts.strict !== false;
    const fields = table.columns
      .map((col) => `  ${JSON.stringify(col.name)}: ${fieldSchema(col)},`)
      .join("\n");
    const tail = strict ? `, { additionalProperties: false }` : "";
    const parts = [
      `export const ${exportNameFor(table, snapshot)} = Type.Object({\n${fields}\n}${tail});`,
    ];
    if (opts.emit?.insert && table.kind === "table") {
      parts.push(variantBody(table, strict, `${baseNameFor(table, snapshot)}Insert`, insertOptional));
    }
    if (opts.emit?.update && table.kind === "table") {
      parts.push(variantBody(table, strict, `${baseNameFor(table, snapshot)}Update`, () => true));
    }
    return {
      imports: [{ from: "@sinclair/typebox", names: ["Type"] }],
      body: parts.join("\n\n"),
      exportName: exportNameFor(table, snapshot),
    };
  }

  renderTypes(table: Table, snapshot: Snapshot, opts: TypeboxTargetOptions): string {
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
      'import type { TSchema } from "@sinclair/typebox";',
      "",
      `export type ${rowType} = {`,
      fields,
      "};",
      `export declare const ${name}: TSchema;`,
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
      lines.push(`export declare const ${exportName}: TSchema;`);
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
        const s = schema as TSchema;
        if (Value.Check(s, value)) return { ok: true };
        const first = Value.Errors(s, value).First();
        return {
          ok: false,
          reason: first ? `${first.path}: ${first.message}` : "invalid",
        };
      },
    };
  }
}

export default TypeboxTarget;
