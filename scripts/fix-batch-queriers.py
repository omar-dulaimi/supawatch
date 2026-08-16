#!/usr/bin/env python3
"""Give the batch tests' PGlite queriers the enum-array delta: the
fixture's `states` column comes back as the raw pg literal from PGlite,
while a fresh postgres.js connection (what schemas model) parses it."""
import pathlib

root = pathlib.Path(__file__).resolve().parent.parent

OLD = """      for (const [k, v] of Object.entries(row)) {
        out[k] = typeof v === "bigint" ? v.toString() : v;
      }"""
NEW = """      for (const [k, v] of Object.entries(row)) {
        // enum-array-literal-vs-array delta: the fixture's enum-array
        // column arrives as the raw literal from PGlite.
        if (k === "states" && typeof v === "string") out[k] = parsePgTextArray(v);
        else out[k] = typeof v === "bigint" ? v.toString() : v;
      }"""

for name in ["batch1-targets", "batch2-targets", "batch4-targets"]:
    p = root / f"packages/verify/test/{name}.test.ts"
    s = p.read_text()
    if OLD not in s:
        raise SystemExit(f"{name}: querier body not found")
    s = s.replace(OLD, NEW)
    if "parsePgTextArray" not in s.split("querierFromPglite")[0]:
        s = s.replace(
            'from "@supawatch/verify";',
            'from "@supawatch/verify";\nimport { parsePgTextArray } from "@supawatch/verify";',
            1,
        )
    p.write_text(s)
    print(name, "ok")
