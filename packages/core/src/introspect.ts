import { arrayRuntimeFor, runtimeFor } from "./runtime-map.js";
import type {
  Column,
  CompositeTypeInfo,
  DomainType,
  EnumType,
  Querier,
  Snapshot,
  Table,
} from "./types.js";

interface ColumnRow {
  table_schema: string;
  table_name: string;
  rel_kind: string;
  column_name: string;
  sql_type: string;
  pg_type_name: string;
  type_kind: string;
  effective_type_name: string;
  effective_type_kind: string;
  is_array: boolean;
  declared_dims: number;
  element_type_name: string | null;
  element_type_kind: string | null;
  is_nullable: boolean;
  has_default: boolean;
}

interface EnumRow {
  enum_schema: string;
  enum_name: string;
  label: string;
}

interface DomainRow {
  domain_schema: string;
  domain_name: string;
  base_type_name: string;
}

interface CompositeRow {
  composite_schema: string;
  composite_name: string;
}

export interface IntrospectOptions {
  includeViews?: boolean;
}

export async function introspect(
  query: Querier,
  schemas: string[] = ["public"],
  opts: IntrospectOptions = {},
): Promise<Snapshot> {
  const includeViews = opts.includeViews !== false;
  const relkinds = includeViews ? ["r", "v"] : ["r"];

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

  // Domains resolve through the recursive CTE below; a domain over a
  // domain lands on the ultimate base type.
  const domainRows = await query<DomainRow>(
    `with recursive chain as (
       select t.oid, t.typname, n.nspname, t.typbasetype
       from pg_type t
       join pg_namespace n on n.oid = t.typnamespace
       where t.typtype = 'd' and n.nspname = any($1)
       union all
       select c.oid, c.typname, c.nspname, bt.typbasetype
       from chain c
       join pg_type bt on bt.oid = c.typbasetype
       where bt.typtype = 'd'
     )
     select distinct on (c.oid)
       c.nspname as domain_schema,
       c.typname as domain_name,
       bt.typname as base_type_name
     from chain c
     join pg_type bt on bt.oid = c.typbasetype
     where bt.typtype <> 'd'
     order by c.oid`,
    [schemas],
  );
  const domains: DomainType[] = domainRows.map((r) => ({
    schema: r.domain_schema,
    name: r.domain_name,
    baseTypeName: r.base_type_name,
  }));

  // Standalone composites only: every table also has a rowtype with
  // typtype 'c', filtered out via the owning relation's relkind.
  const compositeRows = await query<CompositeRow>(
    `select n.nspname as composite_schema, t.typname as composite_name
     from pg_type t
     join pg_namespace n on n.oid = t.typnamespace
     join pg_class c on c.oid = t.typrelid
     where t.typtype = 'c' and c.relkind = 'c' and n.nspname = any($1)
     order by t.typname`,
    [schemas],
  );
  const composites: CompositeTypeInfo[] = compositeRows.map((r) => ({
    schema: r.composite_schema,
    name: r.composite_name,
  }));

  const columnRows = await query<ColumnRow>(
    `with recursive resolve as (
       select t.oid as start_oid, t.oid, t.typname, t.typtype
       from pg_type t
       union all
       select r.start_oid, bt.oid, bt.typname, bt.typtype
       from resolve r
       join pg_type src on src.oid = r.oid and src.typtype = 'd'
       join pg_type bt on bt.oid = src.typbasetype
     ),
     effective as (
       select distinct on (start_oid) start_oid, oid, typname, typtype
       from resolve
       where typtype <> 'd'
       order by start_oid, oid
     )
     select
       n.nspname as table_schema,
       c.relname as table_name,
       c.relkind::text as rel_kind,
       a.attname as column_name,
       format_type(a.atttypid, a.atttypmod) as sql_type,
       t.typname as pg_type_name,
       t.typtype::text as type_kind,
       eff.typname as effective_type_name,
       eff.typtype::text as effective_type_kind,
       (eff_t.typcategory = 'A' and eff_t.typelem <> 0) as is_array,
       greatest(a.attndims, 1) as declared_dims,
       el_eff.typname as element_type_name,
       el_eff.typtype::text as element_type_kind,
       not a.attnotnull as is_nullable,
       a.atthasdef as has_default
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     join pg_attribute a on a.attrelid = c.oid
     join pg_type t on t.oid = a.atttypid
     join effective eff on eff.start_oid = t.oid
     join pg_type eff_t on eff_t.oid = eff.oid
     left join pg_type el on el.oid = eff_t.typelem and eff_t.typcategory = 'A'
     left join effective el_eff on el_eff.start_oid = el.oid
     where n.nspname = any($1)
       and c.relkind = any($2)
       and a.attnum > 0
       and not a.attisdropped
     order by c.relname, a.attnum`,
    [schemas, relkinds],
  );

  const tables = new Map<string, Table>();
  for (const r of columnRows) {
    const key = `${r.table_schema}.${r.table_name}`;
    let table = tables.get(key);
    if (!table) {
      table = {
        schema: r.table_schema,
        name: r.table_name,
        kind: r.rel_kind === "v" ? "view" : "table",
        columns: [],
      };
      tables.set(key, table);
    }
    // Runtime is decided from the EFFECTIVE type: a domain column
    // behaves exactly as its base type at the driver level. Array
    // columns resolve their element the same way.
    let runtime;
    if (r.is_array && r.element_type_name) {
      const element = runtimeFor(
        r.element_type_name,
        r.element_type_kind ?? "b",
        { enums: enumList },
      );
      runtime = arrayRuntimeFor(element, r.declared_dims);
    } else {
      runtime = runtimeFor(r.effective_type_name, r.effective_type_kind, {
        enums: enumList,
      });
    }
    const col: Column = {
      name: r.column_name,
      sqlType: r.sql_type,
      pgTypeName: r.pg_type_name,
      runtime,
      nullable: r.is_nullable,
      hasDefault: r.has_default,
    };
    if (runtime.kind === "enum") col.enumRef = r.effective_type_name;
    table.columns.push(col);
  }

  return { tables: [...tables.values()], enums: enumList, domains, composites };
}
