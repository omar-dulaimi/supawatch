import pathlib

root = pathlib.Path(__file__).resolve().parent.parent

t = root / "packages/core/src/types.ts"
s = t.read_text()
s = s.replace(
    """export interface Table {
  schema: string;
  name: string;
  // Column names of the primary key, empty when the table has none.
  primaryKey: string[];""",
    """export interface RlsPolicy {
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
  primaryKey: string[];""",
)
t.write_text(s)
print("types ok")

i = root / "packages/core/src/introspect.ts"
s = i.read_text()
s = s.replace(
    "       c.relkind::text as rel_kind,",
    "       c.relkind::text as rel_kind,\n       c.relrowsecurity as rls_enabled,",
)
s = s.replace(
    "  rel_kind: string;",
    "  rel_kind: string;\n  rls_enabled: boolean;",
)
s = s.replace(
    """  const pkRows = await query<{""",
    """  const policyRows = await query<{
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
    const key = `${r.table_schema}.${r.table_name}`;
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

  const pkRows = await query<{""",
)
s = s.replace(
    """        kind: r.rel_kind === "v" ? "view" : "table",
        ...(r.table_comment ? { comment: r.table_comment } : {}),
        primaryKey: pkByTable.get(key) ?? [],""",
    """        kind: r.rel_kind === "v" ? "view" : "table",
        rlsEnabled: r.rls_enabled === true,
        policies: policiesByTable.get(key) ?? [],
        ...(r.table_comment ? { comment: r.table_comment } : {}),
        primaryKey: pkByTable.get(key) ?? [],""",
)
i.write_text(s)
print("introspect ok")

d = root / "packages/core/src/diff.ts"
s = d.read_text()
s = s.replace(
    """    if ((prevC.comment ?? "") !== (nextC.comment ?? "")) {
      changes.push(`comment on ${name}.${colName} changed`);
    }
  }""",
    """    if ((prevC.comment ?? "") !== (nextC.comment ?? "")) {
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
  }""",
)
d.write_text(s)
print("diff ok")

x = root / "packages/core/src/index.ts"
s = x.read_text()
s = s.replace("  Rendered,\n", "  Rendered,\n  RlsPolicy,\n")
x.write_text(s)
print("index ok")
