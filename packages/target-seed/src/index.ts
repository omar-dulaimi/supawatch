import type {
  Column,
  RuntimeType,
  Snapshot,
  SnapshotFile,
  Table,
  Target,
  TargetCapabilities,
  TargetOptions,
} from "@supawatch/core";

// Emits seed.sql: deterministic, FK-aware seed rows. Parents insert
// before children, identity columns get explicit ids via OVERRIDING
// SYSTEM VALUE, sequences are resynced with setval, enum labels are
// real, and the byte output is stable for an unchanged schema, so the
// file diffs like code. Tables the generator cannot seed honestly are
// skipped with a comment saying exactly why, never guessed at.

export interface SeedTargetOptions extends TargetOptions {
  rows?: number;
}

// Deterministic PRNG (mulberry32), seeded per column so output is
// stable regardless of table iteration order changes.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function sqlString(s: string): string {
  return "'" + s.replace(/'/g, "''") + "'";
}

function deterministicUuid(rand: () => number): string {
  const hex = () => Math.floor(rand() * 16).toString(16);
  const s = (n: number) => Array.from({ length: n }, hex).join("");
  // version 4 and variant bits set, so validators accept it
  return `${s(8)}-${s(4)}-4${s(3)}-${"89ab"[Math.floor(rand() * 4)]}${s(3)}-${s(12)}`;
}

function literalFor(
  runtime: RuntimeType,
  col: Column,
  table: Table,
  rowIndex: number,
  rand: () => number,
): string | null {
  switch (runtime.kind) {
    case "number":
      return runtime.integer
        ? String(1 + Math.floor(rand() * 1000))
        : (rand() * 100).toFixed(2);
    case "string":
      switch (runtime.format) {
        case "uuid":
          return sqlString(deterministicUuid(rand));
        case "numeric":
          return sqlString((rand() * 1000).toFixed(2));
        case "bigint":
          return sqlString(String(1 + Math.floor(rand() * 100000)));
        case "composite":
        case "array-literal":
          return null; // cannot construct honestly from here
        default:
          return sqlString(`${table.name} ${col.name} ${rowIndex + 1}`);
      }
    case "boolean":
      return rand() < 0.5 ? "true" : "false";
    case "date": {
      const day = 1 + Math.floor(rand() * 27);
      const month = 1 + Math.floor(rand() * 12);
      return sqlString(
        `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T09:00:00Z`,
      );
    }
    case "bytes":
      return "'\\x00'";
    case "json":
      return sqlString("{}") + "::jsonb";
    case "enum": {
      const label = runtime.labels[rowIndex % runtime.labels.length];
      return sqlString(label) + `::"${col.pgTypeName.replace(/^_/, "")}"`;
    }
    case "array": {
      const el = literalFor(runtime.element, col, table, rowIndex, rand);
      if (el === null) return null;
      return `array[${el}]`;
    }
    case "unknown":
      return null;
  }
}

// Kahn's algorithm over single-column FK edges; nullable-FK edges are
// soft (broken first on cycles, seeded as null).
function topoSort(tables: Table[]): { ordered: Table[]; cyclic: Table[] } {
  const byName = new Map(tables.map((t) => [`${t.schema}.${t.name}`, t]));
  const deps = new Map<string, Set<string>>();
  for (const t of tables) {
    const key = `${t.schema}.${t.name}`;
    const set = new Set<string>();
    for (const fk of t.foreignKeys) {
      const target = `${fk.referencedSchema}.${fk.referencedTable}`;
      const col = t.columns.find((c) => c.name === fk.columns[0]);
      if (target !== key && byName.has(target) && col && !col.nullable) {
        set.add(target);
      }
    }
    deps.set(key, set);
  }
  const ordered: Table[] = [];
  const done = new Set<string>();
  let progress = true;
  while (progress) {
    progress = false;
    for (const t of tables) {
      const key = `${t.schema}.${t.name}`;
      if (done.has(key)) continue;
      const remaining = [...(deps.get(key) ?? [])].filter((d) => !done.has(d));
      if (remaining.length === 0) {
        ordered.push(t);
        done.add(key);
        progress = true;
      }
    }
  }
  const cyclic = tables.filter((t) => !done.has(`${t.schema}.${t.name}`));
  return { ordered, cyclic };
}

export class SeedTarget implements Target<SeedTargetOptions> {
  readonly name = "seed";
  readonly fileExtension = ".sql";
  readonly barrel = false;
  readonly capabilities: TargetCapabilities = {
    strictObjects: false,
    brandedTypes: false,
    dateInstances: false,
  };

  renderTable(): never {
    throw new Error("seed is a snapshot-level target");
  }

  renderSnapshot(snapshot: Snapshot, opts: SeedTargetOptions): SnapshotFile[] {
    const rows = opts.rows ?? 3;
    const lines: string[] = [
      "-- Generated by supawatch. Do not edit.",
      "-- Deterministic seed data; identical schema produces identical bytes.",
      "begin;",
    ];

    const tables = snapshot.tables.filter((t) => t.kind === "table");
    const byName = new Map(tables.map((t) => [`${t.schema}.${t.name}`, t]));
    // Domains can carry CHECK constraints the snapshot does not record,
    // so a base-type literal is a guess that may not apply. Never guess:
    // let the database fill nullable or defaulted domain columns, and
    // skip tables that require one.
    const domainNames = new Set(snapshot.domains.map((d) => d.name));

    // The literal a table's Nth row uses for its single-column primary
    // key. Children reuse this for their FK cells, so uuid and numeric
    // parents both reference correctly. Deterministic by construction.
    const pkLiteral = (t: Table, i: number): string | null => {
      const pkName = t.primaryKey.length === 1 ? t.primaryKey[0] : null;
      if (!pkName) return null;
      const col = t.columns.find((c) => c.name === pkName);
      if (!col) return null;
      if (col.runtime.kind === "number") return String(i + 1);
      // bigint primary keys arrive as strings from the driver but seed
      // sequentially like any serial, so sequences resync and post-seed
      // inserts reference real parents.
      if (col.runtime.kind === "string" && col.runtime.format === "bigint") {
        return String(i + 1);
      }
      const rand = mulberry32(hashString(`${t.schema}.${t.name}.${pkName}.${i}`));
      return literalFor(col.runtime, col, t, i, rand);
    };

    const { ordered, cyclic } = topoSort(tables);
    for (const t of cyclic) {
      lines.push(
        `-- skipped ${t.schema}.${t.name}: required foreign keys form a cycle`,
      );
    }

    for (const table of ordered) {
      const q = (s: string) => '"' + s.replace(/"/g, '""') + '"';
      const ident = `${q(table.schema)}.${q(table.name)}`;
      const pk = table.primaryKey.length === 1 ? table.primaryKey[0] : null;

      const skipReasons: string[] = [];
      const cols: Column[] = [];
      for (const col of table.columns) {
        if (col.generated) continue;
        // A non-PK identity-always column cannot take a value without
        // OVERRIDING applying to it too; let the database fill it.
        if (col.identity === "always" && col.name !== pk) continue;
        const fk = table.foreignKeys.find((f) => f.columns.includes(col.name));
        if (fk && f_multi(fk)) {
          if (!col.nullable && !col.hasDefault) {
            skipReasons.push(`multi-column foreign key on ${col.name}`);
          }
          continue;
        }
        if (domainNames.has(col.pgTypeName)) {
          if (col.name === pk) {
            skipReasons.push(
              `primary key ${col.name} is a domain type (its constraints are not introspected)`,
            );
          } else if (!col.nullable && !col.hasDefault) {
            skipReasons.push(
              `domain type on ${col.name} (its constraints are not introspected)`,
            );
          }
          continue;
        }
        if (col.name === pk) {
          cols.push(col);
          continue;
        }
        if (fk) {
          cols.push(col);
          continue;
        }
        const probe = literalFor(col.runtime, col, table, 0, mulberry32(1));
        if (probe === null) {
          if (!col.nullable && !col.hasDefault) {
            skipReasons.push(`no honest value for ${col.name} (${col.sqlType})`);
          }
          continue; // defaulted or nullable: let the database fill it
        }
        cols.push(col);
      }

      if (skipReasons.length > 0) {
        lines.push(
          `-- skipped ${table.schema}.${table.name}: ${skipReasons.join("; ")}`,
        );
        continue;
      }
      if (cols.length === 0) continue;

      const hasIdentityAlways = table.columns.some(
        (c) => c.identity === "always" && c.name === pk,
      );
      const overriding = hasIdentityAlways ? " overriding system value" : "";

      const colList = cols.map((c) => q(c.name)).join(", ");
      for (let i = 0; i < rows; i++) {
        const values = cols.map((col) => {
          if (col.name === pk) {
            const ref = pkLiteral(table, i);
            if (ref !== null) return ref;
          }
          const fk = table.foreignKeys.find((f) => f.columns.includes(col.name));
          if (fk) {
            if (col.nullable && i === rows - 1) return "null";
            const parent = byName.get(`${fk.referencedSchema}.${fk.referencedTable}`);
            const ref = parent ? pkLiteral(parent, i % rows) : null;
            return ref ?? "null";
          }
          if (col.nullable && i === rows - 1) return "null";
          const rand = mulberry32(
            hashString(`${table.schema}.${table.name}.${col.name}.${i}`),
          );
          return literalFor(col.runtime, col, table, i, rand) ?? "null";
        });
        lines.push(
          `insert into ${ident} (${colList})${overriding} values (${values.join(", ")});`,
        );
      }

      if (pk) {
        const pkCol = table.columns.find((c) => c.name === pk);
        const pkIsSequential =
          pkCol &&
          (pkCol.runtime.kind === "number" ||
            (pkCol.runtime.kind === "string" && pkCol.runtime.format === "bigint"));
        if (pkCol && (pkCol.identity || pkCol.hasDefault) && pkIsSequential) {
          lines.push(
            `select setval(pg_get_serial_sequence('${ident.replace(/'/g, "''")}', ${sqlString(pk)}), ${rows}, true);`,
          );
        }
      }
    }

    lines.push("commit;", "");
    return [{ file: "seed.sql", content: lines.join("\n") }];
  }
}

function f_multi(fk: { columns: string[] }): boolean {
  return fk.columns.length > 1;
}

export default SeedTarget;
