#!/usr/bin/env python3
"""Second pass: the exportNameFor(+suffix) helpers and stragglers."""
import pathlib
import re
import sys

root = pathlib.Path(__file__).resolve().parent.parent / "packages"
failures = []

def add_import(s):
    if "exportBaseName" in s:
        return s
    anchor = 'from "@supawatch/core";\n'
    i = s.find(anchor)
    if i < 0:
        return None
    i += len(anchor)
    return s[:i] + 'import { exportBaseName, fileBaseName } from "@supawatch/core";\n' + s[i:]

def fix(pkg, suffixed_fn=True, extra=None):
    p = root / pkg / "src/index.ts"
    s = p.read_text()
    s = add_import(s)
    if s is None:
        failures.append(pkg + " (import)")
        return
    if suffixed_fn:
        m = re.search(
            r"export function exportNameFor\(table: Table\): string \{\n"
            r"  return table\.name\.replace\(/\[\^a-zA-Z0-9_\]/g, \"_\"\) \+ \"(\w+)\";\n\}",
            s,
        )
        if not m:
            failures.append(pkg + " (exportNameFor)")
            return
        s = s.replace(
            m.group(0),
            "export function exportNameFor(table: Table, snapshot: Snapshot): string {\n"
            f'  return exportBaseName(table, snapshot) + "{m.group(1)}";\n}}',
        )
        s = s.replace("exportNameFor(table)", "exportNameFor(table, snapshot)")
    if extra:
        s = extra(s)
    s = s.replace("_snapshot: Snapshot", "snapshot: Snapshot")
    p.write_text(s)
    print(pkg, "ok")

for pkg in ["target-zod", "target-valibot", "target-arktype", "target-typebox", "target-json-schema", "target-forms"]:
    fix(pkg)

def fastcheck_extra(s):
    return s.replace(
        'const rowType = table.name.replace(/[^a-zA-Z0-9_]/g, "_") + "ArbRow";',
        'const rowType = exportBaseName(table, snapshot) + "ArbRow";',
    )
fix("target-fast-check", extra=fastcheck_extra)

def realtime_extra(s):
    s = s.replace(
        'function baseNameFor(name: string): string {\n'
        '  const clean = name.replace(/[^a-zA-Z0-9_]/g, "_");\n'
        "  return clean.charAt(0).toUpperCase() + clean.slice(1);\n}",
        "function baseNameFor(table: { schema: string; name: string }, snapshot: { tables: { schema: string }[] }): string {\n"
        "  const clean = exportBaseName(table, snapshot);\n"
        "  return clean.charAt(0).toUpperCase() + clean.slice(1);\n}",
    )
    s = s.replace("baseNameFor(table.name)", "baseNameFor(table, snapshot)")
    return s
fix("target-realtime", suffixed_fn=False, extra=realtime_extra)

def graphql_extra(s):
    return s.replace(
        'const field = table.name.replace(/[^a-zA-Z0-9_]/g, "_");',
        "const field = exportBaseName(table, snapshot);",
    )
fix("target-graphql", suffixed_fn=False, extra=graphql_extra)

if failures:
    print("FAILED:", ", ".join(failures))
    sys.exit(1)
