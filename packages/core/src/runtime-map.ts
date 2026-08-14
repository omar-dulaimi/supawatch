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
      return { kind: "date" };
    case "json":
    case "jsonb":
      return { kind: "json" };
    default:
      return { kind: "unknown" };
  }
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
  "json",
  "jsonb",
] as const;
