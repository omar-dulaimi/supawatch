import { arrayRuntimeFor, runtimeFor, type DriverProfile } from "./runtime-map.js";
import type {
  Column,
  CompositeTypeInfo,
  DomainType,
  EnumType,
  ForeignKey,
  FunctionInfo,
  Querier,
  Snapshot,
  Table,
} from "./types.js";

interface ColumnRow {
  table_schema: string;
  table_name: string;
  rel_kind: string;
  rls_enabled: boolean;
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
  identity_kind: string;
  is_generated: boolean;
  column_comment: string | null;
  table_comment: string | null;
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
  has_constraints: boolean;
}

interface CompositeRow {
  composite_schema: string;
  composite_name: string;
  field_name: string;
  field_type_name: string;
  field_type_kind: string;
}

export interface IntrospectOptions {
  includeViews?: boolean;
  profile?: DriverProfile;
}


// Internal map key for a relation. A plain schema.name join is ambiguous
// (schema "a.b" table "c" vs schema "a" table "b.c"); the separator
// cannot appear in identifiers.
const relKey = (schema: string, name: string): string => `${schema}\u0000${name}`;

export async function introspect(
  query: Querier,
  schemas: string[] = ["public"],
  opts: IntrospectOptions = {},
): Promise<Snapshot> {
  const includeViews = opts.includeViews !== false;
  const profile = opts.profile ?? "postgres-js";
  // 'r' plain tables, 'p' partitioned parents (their internal partitions
  // are excluded below), 'f' foreign tables, 'v' views, 'm' materialized
  // views.
  const relkinds = includeViews ? ["r", "p", "f", "v", "m"] : ["r", "p", "f"];

  // LEFT JOIN: an enum can exist with zero labels, and it must still be
  // an enum in the snapshot, not an unknown.
  const enumRows = await query<EnumRow>(
    `select n.nspname as enum_schema, t.typname as enum_name, e.enumlabel as label
     from pg_type t
     left join pg_enum e on e.enumtypid = t.oid
     join pg_namespace n on n.oid = t.typnamespace
     where n.nspname = any($1) and t.typtype = 'e'
     order by t.typname, e.enumsortorder`,
    [schemas],
  );

  const enums = new Map<string, EnumType>();
  for (const r of enumRows) {
    const key = relKey(r.enum_schema, r.enum_name);
    let e = enums.get(key);
    if (!e) {
      e = { schema: r.enum_schema, name: r.enum_name, labels: [] };
      enums.set(key, e);
    }
    if (r.label !== null) e.labels.push(r.label);
  }
  const enumList = [...enums.values()];

  // Domains resolve through the recursive CTE below; a domain over a
  // domain lands on the ultimate base type.
  // The constrained flag accumulates over the whole chain: a domain over
  // a constrained domain is itself constrained for insert purposes.
  const domainRows = await query<DomainRow>(
    `with recursive chain as (
       select t.oid, t.typname, n.nspname, t.typbasetype,
         (t.typnotnull or exists (
           select 1 from pg_constraint x where x.contypid = t.oid
         )) as constrained
       from pg_type t
       join pg_namespace n on n.oid = t.typnamespace
       where t.typtype = 'd' and n.nspname = any($1)
       union all
       select c.oid, c.typname, c.nspname, bt.typbasetype,
         (c.constrained or bt.typnotnull or exists (
           select 1 from pg_constraint x where x.contypid = bt.oid
         )) as constrained
       from chain c
       join pg_type bt on bt.oid = c.typbasetype
       where bt.typtype = 'd'
     )
     select distinct on (c.oid)
       c.nspname as domain_schema,
       c.typname as domain_name,
       bt.typname as base_type_name,
       c.constrained as has_constraints
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
    hasConstraints: Boolean(r.has_constraints),
  }));

  // Standalone composites only: every table also has a rowtype with
  // typtype 'c', filtered out via the owning relation's relkind. Fields
  // come from the composite's own pg_attribute rows, and their runtimes
  // resolve like column runtimes so a future parser has the true shapes,
  // even while a composite COLUMN's schema stays a string.
  const compositeRows = await query<CompositeRow>(
    `select n.nspname as composite_schema, t.typname as composite_name,
       a.attname as field_name, ft.typname as field_type_name,
       ft.typtype::text as field_type_kind
     from pg_type t
     join pg_namespace n on n.oid = t.typnamespace
     join pg_class c on c.oid = t.typrelid
     join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
     join pg_type ft on ft.oid = a.atttypid
     where t.typtype = 'c' and c.relkind = 'c' and n.nspname = any($1)
     order by t.typname, a.attnum`,
    [schemas],
  );
  const compositeMap = new Map<string, CompositeTypeInfo>();
  for (const r of compositeRows) {
    const key = `${r.composite_schema}.${r.composite_name}`;
    let comp = compositeMap.get(key);
    if (!comp) {
      comp = { schema: r.composite_schema, name: r.composite_name, fields: [] };
      compositeMap.set(key, comp);
    }
    comp.fields.push({
      name: r.field_name,
      pgTypeName: r.field_type_name,
      runtime: runtimeFor(
        r.field_type_name,
        r.field_type_kind,
        { enums: enumList },
        profile,
      ),
    });
  }
  const composites: CompositeTypeInfo[] = [...compositeMap.values()];

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
       c.relrowsecurity as rls_enabled,
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
       a.atthasdef as has_default,
       a.attidentity::text as identity_kind,
       (a.attgenerated <> '') as is_generated,
       col_description(c.oid, a.attnum) as column_comment,
       obj_description(c.oid, 'pg_class') as table_comment
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
       and not c.relispartition
       and a.attnum > 0
       and not a.attisdropped
     order by c.relname, a.attnum`,
    [schemas, relkinds],
  );

  // Plain functions only (prokind 'f'): no procedures, aggregates or
  // window functions, and none owned by extensions. IN and INOUT args
  // in call order; pronargdefaults counts trailing defaulted args.
  const fnRows = await query<{
    fn_schema: string;
    fn_name: string;
    arg_names: string[] | null;
    arg_types: string[];
    n_defaults: number;
    ret_type: string;
    ret_kind: string;
    ret_set: boolean;
  }>(
    `select
       n.nspname as fn_schema,
       p.proname as fn_name,
       p.proargnames as arg_names,
       coalesce(
         (select array_agg(t.typname order by ord.n)
          from unnest(p.proargtypes) with ordinality as ord(oid, n)
          join pg_type t on t.oid = ord.oid),
         '{}'
       ) as arg_types,
       p.pronargdefaults as n_defaults,
       rt.typname as ret_type,
       rt.typtype::text as ret_kind,
       p.proretset as ret_set
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     join pg_type rt on rt.oid = p.prorettype
     where n.nspname = any($1)
       and p.prokind = 'f'
       and rt.typname <> 'trigger'
       and not exists (
         select 1 from pg_depend d
         where d.objid = p.oid and d.deptype = 'e'
       )
     order by p.proname`,
    [schemas],
  );
  const functions: FunctionInfo[] = fnRows.map((r) => {
    const argCount = r.arg_types.length;
    const firstDefault = argCount - r.n_defaults;
    return {
      schema: r.fn_schema,
      name: r.fn_name,
      args: r.arg_types.map((typeName, idx) => ({
        name: r.arg_names?.[idx] ?? `arg${idx + 1}`,
        pgTypeName: typeName,
        runtime: runtimeFor(typeName, "b", { enums: enumList }, profile),
        hasDefault: idx >= firstDefault,
      })),
      returns: {
        pgTypeName: r.ret_type,
        runtime: runtimeFor(r.ret_type, r.ret_kind, { enums: enumList }, profile),
        isSet: r.ret_set,
      },
    };
  });

  const policyRows = await query<{
    table_schema: string;
    table_name: string;
    policy_name: string;
    command: string;
    permissive: string;
    roles: string[] | null;
    using_expr: string | null;
    check_expr: string | null;
  }>(
    `select
       schemaname as table_schema,
       tablename as table_name,
       policyname as policy_name,
       cmd as command,
       permissive,
       roles,
       qual as using_expr,
       with_check as check_expr
     from pg_policies
     where schemaname = any($1)
     order by tablename, policyname`,
    [schemas],
  );
  const policiesByTable = new Map<string, import("./types.js").RlsPolicy[]>();
  for (const r of policyRows) {
    const key = relKey(r.table_schema, r.table_name);
    const list = policiesByTable.get(key) ?? [];
    list.push({
      name: r.policy_name,
      command: r.command,
      permissive: r.permissive === "PERMISSIVE",
      roles: r.roles ?? [],
      using: r.using_expr,
      withCheck: r.check_expr,
    });
    policiesByTable.set(key, list);
  }

  const pkRows = await query<{
    table_schema: string;
    table_name: string;
    columns: string[];
  }>(
    `select
       n.nspname as table_schema,
       c.relname as table_name,
       array_agg(a.attname order by ord.n) as columns
     from pg_constraint con
     join pg_class c on c.oid = con.conrelid
     join pg_namespace n on n.oid = c.relnamespace
     join lateral unnest(con.conkey) with ordinality as ord(attnum, n) on true
     join pg_attribute a on a.attrelid = c.oid and a.attnum = ord.attnum
     where con.contype = 'p' and n.nspname = any($1)
     group by n.nspname, c.relname
     order by c.relname`,
    [schemas],
  );
  const pkByTable = new Map<string, string[]>();
  for (const r of pkRows) {
    pkByTable.set(relKey(r.table_schema, r.table_name), r.columns);
  }

  const fkRows = await query<{
    table_schema: string;
    table_name: string;
    fk_name: string;
    columns: string[];
    ref_schema: string;
    ref_table: string;
    ref_columns: string[];
  }>(
    `select
       n.nspname as table_schema,
       c.relname as table_name,
       con.conname as fk_name,
       array_agg(a.attname order by ord.n) as columns,
       rn.nspname as ref_schema,
       rc.relname as ref_table,
       array_agg(ra.attname order by ord.n) as ref_columns
     from pg_constraint con
     join pg_class c on c.oid = con.conrelid
     join pg_namespace n on n.oid = c.relnamespace
     join pg_class rc on rc.oid = con.confrelid
     join pg_namespace rn on rn.oid = rc.relnamespace
     join lateral unnest(con.conkey, con.confkey) with ordinality
       as ord(attnum, ref_attnum, n) on true
     join pg_attribute a on a.attrelid = c.oid and a.attnum = ord.attnum
     join pg_attribute ra on ra.attrelid = rc.oid and ra.attnum = ord.ref_attnum
     where con.contype = 'f' and n.nspname = any($1)
     group by n.nspname, c.relname, con.conname, rn.nspname, rc.relname
     order by c.relname, con.conname`,
    [schemas],
  );
  const fksByTable = new Map<string, ForeignKey[]>();
  for (const r of fkRows) {
    const key = relKey(r.table_schema, r.table_name);
    const list = fksByTable.get(key) ?? [];
    list.push({
      name: r.fk_name,
      columns: r.columns,
      referencedSchema: r.ref_schema,
      referencedTable: r.ref_table,
      referencedColumns: r.ref_columns,
    });
    fksByTable.set(key, list);
  }

  const kindOfRel = (relkind: string): Table["kind"] =>
    relkind === "v" || relkind === "m"
      ? "view"
      : relkind === "f"
        ? "foreign"
        : "table";

  const tables = new Map<string, Table>();

  // Zero-column relations exist (create table t()); the column loop
  // below never sees them, so seed the map from pg_class first.
  const relRows = await query<{
    table_schema: string;
    table_name: string;
    rel_kind: string;
    rls_enabled: boolean;
    table_comment: string | null;
  }>(
    `select
       n.nspname as table_schema,
       c.relname as table_name,
       c.relkind::text as rel_kind,
       c.relrowsecurity as rls_enabled,
       obj_description(c.oid, 'pg_class') as table_comment
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = any($1)
       and c.relkind = any($2)
       and not c.relispartition
     order by c.relname`,
    [schemas, relkinds],
  );
  for (const r of relRows) {
    const key = relKey(r.table_schema, r.table_name);
    tables.set(key, {
      schema: r.table_schema,
      name: r.table_name,
      kind: kindOfRel(r.rel_kind),
      rlsEnabled: r.rls_enabled === true,
      policies: policiesByTable.get(key) ?? [],
      ...(r.table_comment ? { comment: r.table_comment } : {}),
      primaryKey: pkByTable.get(key) ?? [],
      foreignKeys: fksByTable.get(key) ?? [],
      columns: [],
    });
  }

  for (const r of columnRows) {
    const key = relKey(r.table_schema, r.table_name);
    let table = tables.get(key);
    if (!table) {
      table = {
        schema: r.table_schema,
        name: r.table_name,
        kind: kindOfRel(r.rel_kind),
        rlsEnabled: r.rls_enabled === true,
        policies: policiesByTable.get(key) ?? [],
        ...(r.table_comment ? { comment: r.table_comment } : {}),
        primaryKey: pkByTable.get(key) ?? [],
        foreignKeys: fksByTable.get(key) ?? [],
        columns: [],
      };
      tables.set(key, table);
    }
    // Runtime is decided from the EFFECTIVE type: a domain column
    // behaves exactly as its base type at the driver level. Array
    // columns resolve their element the same way.
    let runtime;
    let elementEnumRef: string | undefined;
    if (r.is_array && r.element_type_name) {
      const element = runtimeFor(
        r.element_type_name,
        r.element_type_kind ?? "b",
        { enums: enumList },
        profile,
      );
      if (element.kind === "enum") elementEnumRef = r.element_type_name;
      runtime = arrayRuntimeFor(element, r.declared_dims, profile);
    } else {
      runtime = runtimeFor(
        r.effective_type_name,
        r.effective_type_kind,
        { enums: enumList },
        profile,
      );
    }
    const col: Column = {
      name: r.column_name,
      sqlType: r.sql_type,
      pgTypeName: r.pg_type_name,
      runtime,
      nullable: r.is_nullable,
      hasDefault: r.has_default,
      identity:
        r.identity_kind === "a"
          ? "always"
          : r.identity_kind === "d"
            ? "default"
            : null,
      generated: r.is_generated,
      ...(r.column_comment ? { comment: r.column_comment } : {}),
    };
    if (runtime.kind === "enum") col.enumRef = r.effective_type_name;
    // Enum arrays keep a reference to their element enum so targets can
    // name the type (seed casts, the Database bridge).
    if (elementEnumRef) col.enumRef = elementEnumRef;
    table.columns.push(col);
  }

  return { tables: [...tables.values()], enums: enumList, domains, composites, functions };
}
