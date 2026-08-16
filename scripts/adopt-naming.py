#!/usr/bin/env python3
"""Adopt core exportBaseName/fileBaseName in every per-table target.

Mechanical, uniform edits:
1. add a value import of the core naming helpers,
2. make baseNameFor/exportNameFor delegate (gaining a snapshot param),
3. thread `snapshot` through every call site,
4. point schemasImportPath imports at fileBaseName so multi-schema
   prefixed files resolve.
"""
import pathlib
import re
import sys

root = pathlib.Path(__file__).resolve().parent.parent / "packages"

BASE_TARGETS = [
    "target-zod", "target-valibot", "target-arktype", "target-typebox",
    "target-fast-check", "target-factories", "target-forms", "target-trpc",
    "target-mcp", "target-ai-tools", "target-graphql",
]
EXPORTNAME_TARGETS = ["target-effect", "target-rest", "target-service", "target-orpc"]

failures = []

def edit(pkg, fn):
    p = root / pkg / "src/index.ts"
    s = p.read_text()
    s2 = fn(s)
    if s2 is None:
        failures.append(pkg)
        return
    p.write_text(s2)
    print(pkg, "ok")

def add_import(s):
    if "exportBaseName" in s:
        return s
    anchor = 'from "@supawatch/core";\n'
    i = s.find(anchor)
    if i < 0:
        return None
    i += len(anchor)
    return s[:i] + 'import { exportBaseName, fileBaseName } from "@supawatch/core";\n' + s[i:]

def thread_calls(s, name):
    # every existing single-arg call gains snapshot
    s = s.replace(f"{name}(table)", f"{name}(table, snapshot)")
    s = s.replace(f"{name}(table.name)", f"{name}(table, snapshot)")
    return s

def unmark_snapshot_params(s):
    # functions that now use `snapshot` must not keep the unused marker
    s = s.replace("_snapshot: Snapshot", "snapshot: Snapshot")
    return s

def base_target(s):
    s = add_import(s)
    if s is None:
        return None
    m = re.search(
        r"function baseNameFor\(table: Table\): string \{\n(?:.*?\n)*?\}",
        s,
    )
    if not m:
        return None
    s = s.replace(
        m.group(0),
        "function baseNameFor(table: Table, snapshot: Snapshot): string {\n"
        "  return exportBaseName(table, snapshot);\n}",
    )
    s = thread_calls(s, "baseNameFor")
    s = unmark_snapshot_params(s)
    # schema imports must follow the (possibly schema-prefixed) file name
    s = s.replace(
        "${importPath}/${table.name}.mjs",
        "${importPath}/${fileBaseName(table, snapshot)}.mjs",
    )
    return s

def exportname_target(s):
    s = add_import(s)
    if s is None:
        return None
    m = re.search(
        r"export function exportNameFor\(table: Table\): string \{\n(?:.*?\n)*?\}",
        s,
    )
    if not m:
        return None
    body = m.group(0)
    # keep the shape (Row suffix or create...X) but source the base from core
    new = body.replace(
        "export function exportNameFor(table: Table): string {",
        "export function exportNameFor(table: Table, snapshot: Snapshot): string {",
    )
    new = re.sub(
        r"table\.name\.replace\(/\[\^a-zA-Z0-9_\]/g, \"_\"\)",
        "exportBaseName(table, snapshot)",
        new,
    )
    new = re.sub(
        r"const base = baseNameFor\(table\);",
        "const base = baseNameFor(table, snapshot);",
        new,
    )
    s = s.replace(body, new)
    # baseNameFor helpers in these files feed exportNameFor
    m2 = re.search(
        r"function baseNameFor\(table: Table\): string \{\n(?:.*?\n)*?\}",
        s,
    )
    if m2:
        s = s.replace(
            m2.group(0),
            "function baseNameFor(table: Table, snapshot: Snapshot): string {\n"
            "  return exportBaseName(table, snapshot);\n}",
        )
    s = thread_calls(s, "baseNameFor")
    s = s.replace("exportNameFor(table)", "exportNameFor(table, snapshot)")
    s = unmark_snapshot_params(s)
    s = s.replace(
        "${importPath}/${table.name}.mjs",
        "${importPath}/${fileBaseName(table, snapshot)}.mjs",
    )
    return s

for pkg in BASE_TARGETS:
    edit(pkg, base_target)
for pkg in EXPORTNAME_TARGETS:
    edit(pkg, exportname_target)

if failures:
    print("FAILED:", ", ".join(failures))
    sys.exit(1)
