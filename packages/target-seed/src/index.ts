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

// Types whose input syntax accepts arbitrary text. Every other
// string-at-runtime type (inet, cidr, macaddr, interval, time, ...)
// constrains its input, so a text placeholder would fail to apply.
const FREE_TEXT_BASE_TYPES = new Set(["text", "varchar", "bpchar", "citext", "name"]);

function literalFor(
  runtime: RuntimeType,
  col: Column,
  table: Table,
  rowIndex: number,
  rand: () => number,
  baseTypeOf: (pgTypeName: string) => string,
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
          return null; // cannot construct honestly from here
        default: {
          const base = baseTypeOf(col.pgTypeName.replace(/^_/, ""));
          if (!FREE_TEXT_BASE_TYPES.has(base)) return null;
          const placeholder = `${table.name} ${col.name} ${rowIndex + 1}`;
          // varchar(n)/char(n) declare a character cap in sqlType
          const cap = /\((\d+)\)/.exec(col.sqlType)?.[1];
          return sqlString(cap ? placeholder.slice(0, Number(cap)) : placeholder);
        }
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
      if (runtime.labels.length === 0) return null; // zero-label enums hold nothing
      const label = runtime.labels[rowIndex % runtime.labels.length];
      return sqlString(label) + `::"${col.pgTypeName.replace(/^_/, "")}"`;
    }
    case "array": {
      const el = literalFor(runtime.element, col, table, rowIndex, rand, baseTypeOf);
      if (el === null) return null;
      return `array[${el}]`;
    }
    case "unknown":
      return null;
  }
}

// Kahn's algorithm over single-column FK edges; nullable-FK edges are
// soft (broken first on cycles, seeded as null).
// Hard edges (required FKs) must be honored; soft edges (nullable FKs)
// are honored too, because a nullable FK cell with a value still needs
// its parent row first. Only when nothing can proceed does a soft edge
// break, and the broken cells seed as null on every row.
function topoSort(tables: Table[]): {
  ordered: Table[];
  cyclic: Table[];
  brokenSoft: Set<string>;
} {
  const byName = new Map(tables.map((t) => [`${t.schema}.${t.name}`, t]));
  const hard = new Map<string, Set<string>>();
  const soft = new Map<string, Map<string, string[]>>();
  for (const t of tables) {
    const key = `${t.schema}.${t.name}`;
    const h = new Set<string>();
    const s = new Map<string, string[]>();
    for (const fk of t.foreignKeys) {
      const target = `${fk.referencedSchema}.${fk.referencedTable}`;
      const col = t.columns.find((c) => c.name === fk.columns[0]);
      if (target === key || !byName.has(target) || !col) continue;
      if (col.nullable) {
        s.set(target, [...(s.get(target) ?? []), col.name]);
      } else {
        h.add(target);
      }
    }
    hard.set(key, h);
    soft.set(key, s);
  }

  const ordered: Table[] = [];
  const done = new Set<string>();
  const brokenSoft = new Set<string>();
  for (;;) {
    let progress = false;
    for (const t of tables) {
      const key = `${t.schema}.${t.name}`;
      if (done.has(key)) continue;
      const hardLeft = [...(hard.get(key) ?? [])].some((d) => !done.has(d));
      const softLeft = [...(soft.get(key)?.keys() ?? [])].some(
        (d) => !done.has(d) && !brokenSoft.has(`${key}::${d}`),
      );
      if (!hardLeft && !softLeft) {
        ordered.push(t);
        done.add(key);
        progress = true;
      }
    }
    if (progress) continue;
    // stuck: break ONE soft edge on the first (deterministic) blocked
    // table whose hard deps are satisfied, then retry
    let broke = false;
    for (const t of tables) {
      const key = `${t.schema}.${t.name}`;
      if (done.has(key)) continue;
      if ([...(hard.get(key) ?? [])].some((d) => !done.has(d))) continue;
      const pending = [...(soft.get(key)?.keys() ?? [])].find(
        (d) => !done.has(d) && !brokenSoft.has(`${key}::${d}`),
      );
      if (pending !== undefined) {
        brokenSoft.add(`${key}::${pending}`);
        broke = true;
        break;
      }
    }
    if (!broke) break;
  }
  const cyclic = tables.filter((t) => !done.has(`${t.schema}.${t.name}`));
  // Column-level view of the broken edges for the emitter.
  const brokenCols = new Set<string>();
  for (const marker of brokenSoft) {
    const [key, target] = marker.split("::");
    for (const colName of soft.get(key)?.get(target) ?? []) {
      brokenCols.add(`${key}.${colName}`);
    }
  }
  return { ordered, cyclic, brokenSoft: brokenCols };
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
    // A base-type literal for a constrained domain is a guess against a
    // CHECK the snapshot does not parse. Never guess: let the database
    // fill nullable or defaulted columns of constrained domains, and
    // skip tables that require one. Unconstrained domains behave as
    // their base type and seed normally.
    const constrainedDomains = new Set(
      snapshot.domains.filter((d) => d.hasConstraints).map((d) => d.name),
    );
    const domainBase = new Map(snapshot.domains.map((d) => [d.name, d.baseTypeName]));
    const baseTypeOf = (name: string): string => domainBase.get(name) ?? name;

    // The literal a table's Nth row uses for its single-column primary
    // key. Children reuse this for their FK cells, so uuid and numeric
    // parents both reference correctly. Deterministic by construction.
    const pkLiteral = (t: Table, i: number): string | null => {
      const pkName = t.primaryKey.length === 1 ? t.primaryKey[0] : null;
      if (!pkName) return null;
      const col = t.columns.find((c) => c.name === pkName);
      if (!col) return null;
      // A stored-generated pk computes its own value from an expression
      // the generator cannot predict; children cannot reference it.
      if (col.generated) return null;
      if (col.runtime.kind === "number") return String(i + 1);
      // bigint primary keys arrive as strings from the driver but seed
      // sequentially like any serial, so sequences resync and post-seed
      // inserts reference real parents.
      if (col.runtime.kind === "string" && col.runtime.format === "bigint") {
        return String(i + 1);
      }
      const rand = mulberry32(hashString(`${t.schema}.${t.name}.${pkName}.${i}`));
      return literalFor(col.runtime, col, t, i, rand, baseTypeOf);
    };

    const { ordered, cyclic, brokenSoft } = topoSort(tables);
    for (const t of cyclic) {
      lines.push(
        `-- skipped ${t.schema}.${t.name}: required foreign keys form a cycle`,
      );
    }

    // Pass 1: plan each table's insertable columns and its own skip
    // reasons, without emitting yet.
    const plans: { table: Table; cols: Column[]; skipReasons: string[] }[] = [];
    for (const table of ordered) {
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
        if (constrainedDomains.has(col.pgTypeName)) {
          if (col.name === pk) {
            skipReasons.push(
              `primary key ${col.name} has a constrained domain type`,
            );
          } else if (!col.nullable && !col.hasDefault) {
            skipReasons.push(`constrained domain type on ${col.name}`);
          }
          continue;
        }
        if (col.name === pk) {
          // A pk with no honest literal (interval, composite, ...) can
          // only work when the database fills it; without a default the
          // table cannot be seeded at all.
          const pkProbe = literalFor(col.runtime, col, table, 0, mulberry32(1), baseTypeOf);
          if (pkProbe === null) {
            if (col.identity || col.hasDefault) continue; // db fills it
            skipReasons.push(
              `primary key ${col.name} has no honest literal (${col.sqlType})`,
            );
            continue;
          }
          cols.push(col);
          continue;
        }
        if (fk) {
          // FK cells reuse the parent's primary-key literals, which is
          // only honest when the FK actually references that primary
          // key. A reference to a UNIQUE column would get pk values in
          // a non-pk column and violate on apply.
          const parent = byName.get(`${fk.referencedSchema}.${fk.referencedTable}`);
          const refsParentPk =
            parent !== undefined &&
            parent.primaryKey.length === 1 &&
            fk.referencedColumns.length === 1 &&
            fk.referencedColumns[0] === parent.primaryKey[0];
          if (!refsParentPk) {
            if (!col.nullable && !col.hasDefault) {
              skipReasons.push(
                `foreign key ${col.name} references ${fk.referencedTable}(${fk.referencedColumns.join(", ")}), not its primary key`,
              );
            }
            continue;
          }
          // ... and the parent's pk values must be predictable
          // (generated or literal-less pks are not).
          if (parent !== undefined && pkLiteral(parent, 0) === null) {
            if (!col.nullable && !col.hasDefault) {
              skipReasons.push(
                `foreign key ${col.name} references ${fk.referencedTable}, whose primary key values the generator cannot predict`,
              );
            }
            continue;
          }
          cols.push(col);
          continue;
        }
        const probe = literalFor(col.runtime, col, table, 0, mulberry32(1), baseTypeOf);
        if (probe === null) {
          if (!col.nullable && !col.hasDefault) {
            skipReasons.push(`no honest value for ${col.name} (${col.sqlType})`);
          }
          continue; // defaulted or nullable: let the database fill it
        }
        cols.push(col);
      }
      plans.push({ table, cols, skipReasons });
    }

    // A required single-column FK into a table that is not seeded (its
    // own reasons, a cycle, or outside the snapshot) makes the child
    // unseedable too; propagate to a fixpoint so seed.sql always
    // applies.
    const skipped = new Set(cyclic.map((t) => `${t.schema}.${t.name}`));
    for (const p of plans) {
      if (p.skipReasons.length > 0) skipped.add(`${p.table.schema}.${p.table.name}`);
    }
    let changed = true;
    while (changed) {
      changed = false;
      for (const p of plans) {
        const key = `${p.table.schema}.${p.table.name}`;
        if (skipped.has(key)) continue;
        for (const fk of p.table.foreignKeys) {
          if (f_multi(fk)) continue;
          const col = p.table.columns.find((c) => fk.columns.includes(c.name));
          if (!col || col.nullable || col.hasDefault) continue;
          const parentKey = `${fk.referencedSchema}.${fk.referencedTable}`;
          if (skipped.has(parentKey) || !byName.has(parentKey)) {
            p.skipReasons.push(
              `required foreign key ${col.name} references ${parentKey}, which is not seeded`,
            );
            skipped.add(key);
            changed = true;
            break;
          }
        }
      }
    }

    // Pass 2: emit.
    for (const { table, cols, skipReasons } of plans) {
      const q = (s: string) => '"' + s.replace(/"/g, '""') + '"';
      const ident = `${q(table.schema)}.${q(table.name)}`;
      const pk = table.primaryKey.length === 1 ? table.primaryKey[0] : null;

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
            // a soft edge broken to escape a cycle seeds null on EVERY
            // row: the parent rows do not exist yet at apply time
            if (brokenSoft.has(`${table.schema}.${table.name}.${col.name}`)) return "null";
            if (col.nullable && i === rows - 1) return "null";
            const parent = byName.get(`${fk.referencedSchema}.${fk.referencedTable}`);
            const ref = parent ? pkLiteral(parent, i % rows) : null;
            return ref ?? "null";
          }
          if (col.nullable && i === rows - 1) return "null";
          const rand = mulberry32(
            hashString(`${table.schema}.${table.name}.${col.name}.${i}`),
          );
          return literalFor(col.runtime, col, table, i, rand, baseTypeOf) ?? "null";
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
