import type { RuntimeType, Snapshot } from "./types.js";

// One table, in one place, mapping a pg type name to what the driver hands
// JavaScript. Every row here must be exercised by a verification test that
// checks a real driver return value; a row nobody has verified does not
// get added. Types outside the table become { kind: "unknown" } on purpose.
export function runtimeFor(
  pgTypeName: string,
  typeKind: string,
  snapshot: Pick<Snapshot, "enums">,
): RuntimeType {
  if (typeKind === "e") {
    const e = snapshot.enums.find((x) => x.name === pgTypeName);
    if (e) return { kind: "enum", labels: e.labels };
  }
  // Measured, not assumed: the driver hands a composite column back as
  // its raw row literal, e.g. "(EUR,950)". A nested object schema here
  // would fail ground truth; string is the honest mapping.
  if (typeKind === "c") {
    return { kind: "string", format: "composite" };
  }
  switch (pgTypeName) {
    case "int2":
    case "int4":
      return { kind: "number", integer: true };
    case "float4":
    case "float8":
      return { kind: "number", integer: false };
    case "int8":
      return { kind: "string", format: "bigint" };
    case "numeric":
      return { kind: "string", format: "numeric" };
    case "uuid":
      return { kind: "string", format: "uuid" };
    case "text":
    case "varchar":
    case "bpchar":
      return { kind: "string" };
    case "bool":
      return { kind: "boolean" };
    case "timestamptz":
    case "timestamp":
    case "date":
      return { kind: "date" }; // both drivers return a Date for plain date too
    case "time":
    case "timetz":
    case "interval":
    case "inet":
    case "cidr":
    case "macaddr":
      return { kind: "string" };
    case "bytea":
      return { kind: "bytes" }; // Uint8Array from PGlite, Buffer from postgres.js
    case "json":
    case "jsonb":
      return { kind: "json" };
    default:
      return { kind: "unknown" };
  }
}

// Arrays, decided from measured evidence:
// - element-typed JS arrays for scalar elements, elements following the
//   same driver truth (numeric[] arrives as string[]),
// - EXCEPT enum arrays, which BOTH drivers hand back as the raw literal
//   string "{a,b}", unparsed,
// - and Postgres does not enforce declared dimensionality; a column
//   declared with more than one dimension maps to array of unknown.
export function arrayRuntimeFor(
  elementRuntime: RuntimeType,
  declaredDims: number,
): RuntimeType {
  if (elementRuntime.kind === "enum") {
    return { kind: "string", format: "array-literal" };
  }
  if (declaredDims > 1) {
    return { kind: "array", element: { kind: "unknown" } };
  }
  return { kind: "array", element: elementRuntime };
}

// The names above, exported so the verify harness can assert every one of
// them has value-pool coverage. Kept beside the switch it describes.
export const MAPPED_PG_TYPES = [
  "int2",
  "int4",
  "float4",
  "float8",
  "int8",
  "numeric",
  "uuid",
  "text",
  "varchar",
  "bpchar",
  "bool",
  "timestamptz",
  "timestamp",
  "date",
  "time",
  "timetz",
  "interval",
  "bytea",
  "inet",
  "cidr",
  "macaddr",
  "json",
  "jsonb",
] as const;
