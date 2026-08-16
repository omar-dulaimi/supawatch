import type { Snapshot, Table } from "./types.js";

export function diff(prev: Snapshot, next: Snapshot): string[] {
  const changes: string[] = [];

  const key = (t: Table) => `${t.schema}.${t.name}`;
  const prevTables = new Map(prev.tables.map((t) => [key(t), t]));
  const nextTables = new Map(next.tables.map((t) => [key(t), t]));

  for (const [k, t] of nextTables) {
    if (!prevTables.has(k)) changes.push(`${t.kind} ${k} created`);
  }
  for (const [k, t] of prevTables) {
    if (!nextTables.has(k)) changes.push(`${t.kind} ${k} dropped`);
  }
  for (const [k, nextT] of nextTables) {
    const prevT = prevTables.get(k);
    if (!prevT) continue;
    if (prevT.kind !== nextT.kind) {
      changes.push(`${k} is now a ${nextT.kind}`);
    }
    changes.push(...diffTable(prevT, nextT));
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

  const prevDomains = new Map(prev.domains.map((d) => [`${d.schema}.${d.name}`, d]));
  const nextDomains = new Map(next.domains.map((d) => [`${d.schema}.${d.name}`, d]));
  for (const [k, d] of nextDomains) {
    if (!prevDomains.has(k)) changes.push(`domain ${k} created (base ${d.baseTypeName})`);
  }
  for (const [k] of prevDomains) {
    if (!nextDomains.has(k)) changes.push(`domain ${k} dropped`);
  }

  const fnKey = (f: { schema: string; name: string; args: { pgTypeName: string }[] }) =>
    `${f.schema}.${f.name}(${f.args.map((a) => a.pgTypeName).join(",")})`;
  const prevFns = new Map(prev.functions.map((f) => [fnKey(f), f]));
  const nextFns = new Map(next.functions.map((f) => [fnKey(f), f]));
  for (const [k] of nextFns) {
    if (!prevFns.has(k)) changes.push(`function ${k} created`);
  }
  for (const [k] of prevFns) {
    if (!nextFns.has(k)) changes.push(`function ${k} dropped`);
  }

  const prevComposites = new Map(prev.composites.map((c) => [`${c.schema}.${c.name}`, c]));
  const nextComposites = new Map(next.composites.map((c) => [`${c.schema}.${c.name}`, c]));
  for (const [k, comp] of nextComposites) {
    const prevC = prevComposites.get(k);
    if (!prevC) {
      changes.push(`composite ${k} created`);
      continue;
    }
    const prevFields = new Map(prevC.fields.map((f) => [f.name, f]));
    const nextFields = new Map(comp.fields.map((f) => [f.name, f]));
    for (const [fname, f] of nextFields) {
      if (!prevFields.has(fname)) {
        changes.push(`composite ${k} gained ${fname} (${f.pgTypeName})`);
      }
    }
    for (const [fname] of prevFields) {
      if (!nextFields.has(fname)) changes.push(`composite ${k} lost ${fname}`);
    }
  }
  for (const [k] of prevComposites) {
    if (!nextComposites.has(k)) changes.push(`composite ${k} dropped`);
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
    if ((prevC.comment ?? "") !== (nextC.comment ?? "")) {
      changes.push(`comment on ${name}.${colName} changed`);
    }
  }
  if (prev.rlsEnabled !== next.rlsEnabled) {
    changes.push(`rls ${next.rlsEnabled ? "enabled" : "disabled"} on ${name}`);
  }
  const prevPolicies = new Map(prev.policies.map((p) => [p.name, p]));
  const nextPolicies = new Map(next.policies.map((p) => [p.name, p]));
  for (const [pname] of nextPolicies) {
    if (!prevPolicies.has(pname)) changes.push(`policy ${pname} created on ${name}`);
  }
  for (const [pname] of prevPolicies) {
    if (!nextPolicies.has(pname)) changes.push(`policy ${pname} dropped on ${name}`);
  }
  if ((prev.comment ?? "") !== (next.comment ?? "")) {
    changes.push(`comment on ${name} changed`);
  }
  return changes;
}
