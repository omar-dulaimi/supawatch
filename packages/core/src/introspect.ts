import { runtimeFor } from "./runtime-map.js";
import type { Column, EnumType, Querier, Snapshot, Table } from "./types.js";

interface ColumnRow {
  table_schema: string;
  table_name: string;
  column_name: string;
  sql_type: string;
  pg_type_name: string;
  type_kind: string;
  is_nullable: boolean;
  has_default: boolean;
}

interface EnumRow {
  enum_schema: string;
  enum_name: string;
  label: string;
}

export async function introspect(
  query: Querier,
  schemas: string[] = ["public"],
): Promise<Snapshot> {
  const enumRows = await query<EnumRow>(
    `select n.nspname as enum_schema, t.typname as enum_name, e.enumlabel as label
     from pg_type t
     join pg_enum e on e.enumtypid = t.oid
     join pg_namespace n on n.oid = t.typnamespace
     where n.nspname = any($1)
     order by t.typname, e.enumsortorder`,
    [schemas],
  );

  const enums = new Map<string, EnumType>();
  for (const r of enumRows) {
    const key = `${r.enum_schema}.${r.enum_name}`;
    let e = enums.get(key);
    if (!e) {
      e = { schema: r.enum_schema, name: r.enum_name, labels: [] };
      enums.set(key, e);
    }
    e.labels.push(r.label);
  }
  const enumList = [...enums.values()];

  const columnRows = await query<ColumnRow>(
    `select
       n.nspname as table_schema,
       c.relname as table_name,
       a.attname as column_name,
       format_type(a.atttypid, a.atttypmod) as sql_type,
       t.typname as pg_type_name,
       t.typtype::text as type_kind,
       not a.attnotnull as is_nullable,
       a.atthasdef as has_default
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     join pg_attribute a on a.attrelid = c.oid
     join pg_type t on t.oid = a.atttypid
     where n.nspname = any($1)
       and c.relkind = 'r'
       and a.attnum > 0
       and not a.attisdropped
     order by c.relname, a.attnum`,
    [schemas],
  );

  const tables = new Map<string, Table>();
  for (const r of columnRows) {
    const key = `${r.table_schema}.${r.table_name}`;
    let table = tables.get(key);
    if (!table) {
      table = { schema: r.table_schema, name: r.table_name, columns: [] };
      tables.set(key, table);
    }
    const runtime = runtimeFor(r.pg_type_name, r.type_kind, {
      enums: enumList,
    });
    const col: Column = {
      name: r.column_name,
      sqlType: r.sql_type,
      pgTypeName: r.pg_type_name,
      runtime,
      nullable: r.is_nullable,
      hasDefault: r.has_default,
    };
    if (runtime.kind === "enum") col.enumRef = r.pg_type_name;
    table.columns.push(col);
  }

  return { tables: [...tables.values()], enums: enumList };
}
