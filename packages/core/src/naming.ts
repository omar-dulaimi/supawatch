import type { Snapshot, Table } from "./types.js";

// The single source of truth for how a table's identity appears in
// generated code. With one schema, names stay bare. With several, both
// the file name and every export name carry the schema, because two
// schemas can hold same-named tables: prefixed files stop the last
// write from winning, and prefixed exports stop the barrel from
// containing ambiguous star exports, which ESM silently drops.

type TableRef = Pick<Table, "schema" | "name">;
type SnapshotRef = Pick<Snapshot, "tables">;

export function isMultiSchema(snapshot: SnapshotRef): boolean {
  return new Set(snapshot.tables.map((t) => t.schema)).size > 1;
}

function cleanIdent(s: string): string {
  const cleaned = s.replace(/[^a-zA-Z0-9_]/g, "_");
  return /^[0-9]/.test(cleaned) ? `_${cleaned}` : cleaned;
}

// JS-identifier-safe base for export names (ordersRow, createOrdersRepo).
export function exportBaseName(table: TableRef, snapshot: SnapshotRef): string {
  return isMultiSchema(snapshot)
    ? `${cleanIdent(table.schema)}_${cleanIdent(table.name)}`
    : cleanIdent(table.name);
}

// On-disk base for per-table files ("orders" or "public.orders").
export function fileBaseName(table: TableRef, snapshot: SnapshotRef): string {
  return isMultiSchema(snapshot) ? `${table.schema}.${table.name}` : table.name;
}
