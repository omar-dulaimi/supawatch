import type { Snapshot, Table } from "./types.js";

export function diff(prev: Snapshot, next: Snapshot): string[] {
  const changes: string[] = [];

  const key = (t: Table) => `${t.schema}.${t.name}`;
  const prevTables = new Map(prev.tables.map((t) => [key(t), t]));
  const nextTables = new Map(next.tables.map((t) => [key(t), t]));

  for (const [k] of nextTables) {
    if (!prevTables.has(k)) changes.push(`table ${k} created`);
  }
  for (const [k] of prevTables) {
    if (!nextTables.has(k)) changes.push(`table ${k} dropped`);
  }
  for (const [k, nextT] of nextTables) {
    const prevT = prevTables.get(k);
    if (prevT) changes.push(...diffTable(prevT, nextT));
  }

  const prevEnums = new Map(prev.enums.map((e) => [`${e.schema}.${e.name}`, e]));
  const nextEnums = new Map(next.enums.map((e) => [`${e.schema}.${e.name}`, e]));

  for (const [k, nextE] of nextEnums) {
    const prevE = prevEnums.get(k);
    if (!prevE) {
      changes.push(`enum ${k} created (${nextE.labels.join(", ")})`);
      continue;
    }
    for (const l of nextE.labels.filter((x) => !prevE.labels.includes(x))) {
      changes.push(`enum ${k} gained '${l}'`);
    }
    for (const l of prevE.labels.filter((x) => !nextE.labels.includes(x))) {
      changes.push(`enum ${k} lost '${l}'`);
    }
  }
  for (const [k] of prevEnums) {
    if (!nextEnums.has(k)) changes.push(`enum ${k} dropped`);
  }

  return changes;
}

function diffTable(prev: Table, next: Table): string[] {
  const changes: string[] = [];
  const name = `${next.schema}.${next.name}`;
  const prevCols = new Map(prev.columns.map((c) => [c.name, c]));
  const nextCols = new Map(next.columns.map((c) => [c.name, c]));

  for (const [colName, col] of nextCols) {
    if (!prevCols.has(colName)) {
      const nul = col.nullable ? "nullable" : "not null";
      changes.push(`${name} gained ${colName} (${col.sqlType}, ${nul})`);
    }
  }
  for (const [colName] of prevCols) {
    if (!nextCols.has(colName)) changes.push(`${name} lost ${colName}`);
  }
  for (const [colName, nextC] of nextCols) {
    const prevC = prevCols.get(colName);
    if (!prevC) continue;
    if (prevC.sqlType !== nextC.sqlType) {
      changes.push(`${name}.${colName} type ${prevC.sqlType} -> ${nextC.sqlType}`);
    }
    if (prevC.nullable !== nextC.nullable) {
      changes.push(
        `${name}.${colName} now ${nextC.nullable ? "nullable" : "not null"}`,
      );
    }
  }
  return changes;
}
