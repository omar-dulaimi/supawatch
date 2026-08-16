// The IR. Columns carry what the driver actually returns at runtime
// (RuntimeType), not just the SQL type; targets render from runtime and
// never from sqlType. That rule is the project's identity.

export type RuntimeType =
  | { kind: "number"; integer: boolean }
  | {
      kind: "string";
      format?: "uuid" | "numeric" | "bigint" | "composite";
    }
  | { kind: "boolean" }
  | { kind: "date" }
  | { kind: "bytes" }
  | { kind: "json" }
  | { kind: "enum"; labels: string[] }
  | { kind: "array"; element: RuntimeType }
  | { kind: "unknown" };

export interface Column {
  name: string;
  sqlType: string;
  pgTypeName: string;
  runtime: RuntimeType;
  nullable: boolean;
  hasDefault: boolean;
  // 'always' identity and stored generated columns cannot be written;
  // 'default' identity behaves like hasDefault for inserts.
  identity: "always" | "default" | null;
  generated: boolean;
  comment?: string;
  enumRef?: string;
}

export interface ForeignKey {
  name: string;
  columns: string[];
  referencedSchema: string;
  referencedTable: string;
  referencedColumns: string[];
}

export interface RlsPolicy {
  name: string;
  command: string; // ALL, SELECT, INSERT, UPDATE, DELETE
  permissive: boolean;
  roles: string[];
  using: string | null;
  withCheck: string | null;
}

export interface Table {
  schema: string;
  name: string;
  // Row-level security state and existing policies, straight from
  // pg_class.relrowsecurity and the pg_policies view.
  rlsEnabled: boolean;
  policies: RlsPolicy[];
  // Column names of the primary key, empty when the table has none.
  primaryKey: string[];
  foreignKeys: ForeignKey[];
  // Views are tables to a reader; the marker exists because Postgres
  // reports every view column as nullable regardless of the underlying
  // column, and consumers deserve to know that is why.
  // "foreign" marks foreign tables (FDW): readable relations that every
  // writable code path treats as read-only.
  kind: "table" | "view" | "foreign";
  comment?: string;
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
  // True when the domain, or any domain in its base chain, carries a
  // CHECK constraint or NOT NULL: a base-type value is then not
  // guaranteed to be accepted.
  hasConstraints: boolean;
}

export interface CompositeField {
  name: string;
  pgTypeName: string;
  runtime: RuntimeType;
}

export interface CompositeTypeInfo {
  schema: string;
  name: string;
  fields: CompositeField[];
}

export interface FunctionArg {
  name: string;
  pgTypeName: string;
  runtime: RuntimeType;
  hasDefault: boolean;
}

export interface FunctionInfo {
  schema: string;
  name: string;
  args: FunctionArg[];
  returns: { pgTypeName: string; runtime: RuntimeType; isSet: boolean };
}

export interface Snapshot {
  tables: Table[];
  enums: EnumType[];
  domains: DomainType[];
  composites: CompositeTypeInfo[];
  functions: FunctionInfo[];
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
  // Emit insert/update variants alongside the row schema. Off by
  // default; the select-row shape is the only one ground truth can
  // verify against real rows.
  emit?: { insert?: boolean; update?: boolean };
  // Tighten the DECLARED type of a json/jsonb column in the .d.mts
  // companion. Runtime validation stays unknown on purpose: the
  // catalog cannot verify a shape the database does not enforce.
  jsonTypes?: Record<string, string>;
}

export interface SnapshotFile {
  file: string;
  content: string;
}

export interface Target<TOptions extends TargetOptions = TargetOptions> {
  readonly name: string;
  readonly capabilities: TargetCapabilities;
  readonly fileExtension: string;
  // Non-module targets (JSON, markdown) opt out of the export barrel.
  readonly barrel?: boolean;
  // Overrides core's JS assembly for targets whose files are not ES
  // modules; receives the Rendered and returns the exact file content.
  assembleFile?(rendered: Rendered): string;
  renderTable(table: Table, snapshot: Snapshot, opts: TOptions): Rendered;
  renderTypes?(table: Table, snapshot: Snapshot, opts: TOptions): string;
  // A snapshot-level target (like the supabase Database bridge) emits
  // whole files instead of per-table schemas; the watcher then skips
  // per-table emit, barrels, and row verification for it.
  renderSnapshot?(snapshot: Snapshot, opts: TOptions): SnapshotFile[];
  // Absent on type-only targets; row verification is skipped for them.
  verifier?(): Verifier;
}
