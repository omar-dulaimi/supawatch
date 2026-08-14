// The IR. Columns carry what the driver actually returns at runtime
// (RuntimeType), not just the SQL type; targets render from runtime and
// never from sqlType. That rule is the project's identity.

export type RuntimeType =
  | { kind: "number"; integer: boolean }
  | { kind: "string"; format?: "uuid" | "numeric" | "bigint" | "composite" }
  | { kind: "boolean" }
  | { kind: "date" }
  | { kind: "json" }
  | { kind: "enum"; labels: string[] }
  | { kind: "unknown" };

export interface Column {
  name: string;
  sqlType: string;
  pgTypeName: string;
  runtime: RuntimeType;
  nullable: boolean;
  hasDefault: boolean;
  enumRef?: string;
}

export interface Table {
  schema: string;
  name: string;
  // Views are tables to a reader; the marker exists because Postgres
  // reports every view column as nullable regardless of the underlying
  // column, and consumers deserve to know that is why.
  kind: "table" | "view";
  columns: Column[];
}

export interface EnumType {
  schema: string;
  name: string;
  labels: string[];
}

export interface DomainType {
  schema: string;
  name: string;
  baseTypeName: string;
}

export interface CompositeTypeInfo {
  schema: string;
  name: string;
}

export interface Snapshot {
  tables: Table[];
  enums: EnumType[];
  domains: DomainType[];
  composites: CompositeTypeInfo[];
}

// Minimal query seam so core never depends on a specific driver. postgres.js
// and PGlite both wrap into this in a few lines each.
export type Querier = <T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
) => Promise<T[]>;

// ---- Target seam ----

export interface Import {
  from: string;
  names?: string[];
  namespace?: string;
}

export interface Rendered {
  imports: Import[];
  body: string;
  exportName: string;
}

export interface Verdict {
  ok: boolean;
  reason?: string;
}

export interface Verifier {
  load(file: string, exportName: string): Promise<unknown>;
  check(schema: unknown, value: unknown): Verdict;
}

export interface TargetCapabilities {
  strictObjects: boolean;
  brandedTypes: boolean;
  dateInstances: boolean;
}

export interface TargetOptions {
  strict?: boolean;
}

export interface Target<TOptions extends TargetOptions = TargetOptions> {
  readonly name: string;
  readonly capabilities: TargetCapabilities;
  readonly fileExtension: string;
  renderTable(table: Table, snapshot: Snapshot, opts: TOptions): Rendered;
  renderTypes?(table: Table, snapshot: Snapshot, opts: TOptions): string;
  verifier(): Verifier;
}
