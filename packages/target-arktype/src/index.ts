import { pathToFileURL } from "node:url";
import { type } from "arktype";
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

export interface ArktypeTargetOptions extends TargetOptions {
  strict?: boolean;
}

// ArkType has two languages: the string DSL for field values, and Type
// expressions. A field value may be either, but the two must never be
// concatenated. Most kinds render as DSL strings; bytes renders as a
// type.instanceOf expression, because the DSL keyword 'Uint8Array'
// throws at parse time. The tagged return keeps the two apart.
type ArkField =
  | { lang: "dsl"; code: string }
  | { lang: "expr"; code: string };

function arkExpr(runtime: RuntimeType): ArkField {
  switch (runtime.kind) {
    case "number":
      // Floats can really be NaN (measured); the DSL number keyword
      // rejects it, while +-Infinity already passes.
      return {
        lang: "dsl",
        code: runtime.integer ? "number.integer" : "number | number.NaN",
      };
    case "string":
      return {
        lang: "dsl",
        code: runtime.format === "uuid" ? "string.uuid" : "string",
      };
    case "boolean":
      return { lang: "dsl", code: "boolean" };
    case "date":
      // ArkType's Date keyword and type.instanceOf(Date) both reject
      // Invalid Date instances (measured), which are real driver output
      // for timestamp 'infinity' and BC values; narrow to instanceof.
      return {
        lang: "expr",
        code: 'type("unknown").narrow((v, ctx) => v instanceof Date || ctx.mustBe("a Date"))',
      };
    case "bytes":
      return { lang: "expr", code: "type.instanceOf(Uint8Array)" };
    case "json":
    case "unknown":
      return { lang: "dsl", code: "unknown" };
    case "array": {
      const el = arkExpr(runtime.element);
      if (el.lang === "expr") return { lang: "expr", code: `${el.code}.array()` };
      const needsParens = el.code.includes("|");
      return {
        lang: "dsl",
        code: needsParens ? `(${el.code})[]` : `${el.code}[]`,
      };
    }
    case "enum":
      if (runtime.labels.length === 0) return { lang: "dsl", code: "never" };
      return {
        lang: "dsl",
        code: runtime.labels.map((l) => `'${l.replace(/'/g, "\\'")}'`).join("|"),
      };
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

// ArkType optionality is a key suffix: "name?". The reject marker for
// undeclared keys rides along per variant.
function variantBody(
  table: Table,
  strict: boolean,
  name: string,
  optionalWhen: (col: Column) => boolean,
): string {
  const rejectLine = strict ? `  "+": "reject",\n` : "";
  const fields = writableColumns(table)
    .map((col) => {
      const key = optionalWhen(col) ? `${col.name}?` : col.name;
      return `  ${JSON.stringify(key)}: ${fieldSchema(col)},`;
    })
    .join("\n");
  return `export const ${name} = type({\n${rejectLine}${fields}\n});`;
}

// Returns the literal code for the field value: quoted DSL, or a raw
// Type expression. Nullability composes inside each language.
function fieldSchema(col: Column): string {
  const base = arkExpr(col.runtime);
  const nullable =
    col.nullable && col.runtime.kind !== "unknown" && col.runtime.kind !== "json";
  if (base.lang === "expr") {
    return nullable ? `${base.code}.or("null")` : base.code;
  }
  const dsl = nullable ? `${base.code}|null` : base.code;
  return JSON.stringify(dsl);
}

export class ArktypeTarget implements Target<ArktypeTargetOptions> {
  readonly name = "arktype";
  readonly fileExtension = ".mjs";
  readonly capabilities: TargetCapabilities = {
    strictObjects: true,
    brandedTypes: false,
    dateInstances: true,
  };

  renderTable(
    table: Table,
    snapshot: Snapshot,
    opts: ArktypeTargetOptions,
  ): Rendered {
    const strict = opts.strict !== false;
    const fields = table.columns
      .map((col) => `  ${JSON.stringify(col.name)}: ${fieldSchema(col)},`)
      .join("\n");
    const rejectLine = strict ? `  "+": "reject",\n` : "";
    const parts = [
      `export const ${exportNameFor(table, snapshot)} = type({\n${rejectLine}${fields}\n});`,
    ];
    if (opts.emit?.insert && table.kind === "table") {
      parts.push(variantBody(table, strict, `${baseNameFor(table, snapshot)}Insert`, insertOptional));
    }
    if (opts.emit?.update && table.kind === "table") {
      parts.push(variantBody(table, strict, `${baseNameFor(table, snapshot)}Update`, () => true));
    }
    return {
      imports: [{ from: "arktype", names: ["type"] }],
      body: parts.join("\n\n"),
      exportName: exportNameFor(table, snapshot),
    };
  }

  renderTypes(table: Table, snapshot: Snapshot, opts: ArktypeTargetOptions): string {
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
      'import type { Type } from "arktype";',
      "",
      `export type ${rowType} = {`,
      fields,
      "};",
      `export declare const ${name}: Type<${rowType}>;`,
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
      lines.push(`export declare const ${exportName}: Type<${typeName}>;`);
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
        const out = (schema as (v: unknown) => unknown)(value);
        if (out instanceof type.errors) {
          return { ok: false, reason: out.summary };
        }
        return { ok: true };
      },
    };
  }
}

export default ArktypeTarget;
