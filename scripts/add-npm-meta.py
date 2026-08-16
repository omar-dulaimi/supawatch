import json
import pathlib

root = pathlib.Path(__file__).resolve().parent.parent

BASE_KEYWORDS = ["supabase", "postgres", "postgresql", "codegen", "schema", "typescript"]

META = {
    "cli": {
        "description": "Validator schemas and types generated from your live Postgres, kept in sync by the database itself.",
        "keywords": BASE_KEYWORDS + ["zod", "valibot", "arktype", "typebox", "cli", "watch", "introspection"],
    },
    "core": {
        "description": "Snapshot IR, catalog introspection, diffing, and the measured runtime-type map behind supawatch.",
        "keywords": BASE_KEYWORDS + ["introspection", "pg_catalog"],
    },
    "watch": {
        "description": "The supawatch watcher runtime: event-trigger LISTEN, polling, debounced regeneration, row verification.",
        "keywords": BASE_KEYWORDS + ["listen", "notify", "watcher"],
    },
    "target-zod": {
        "description": "Zod schemas generated from live Postgres by supawatch, mapped to what the driver actually returns.",
        "keywords": BASE_KEYWORDS + ["zod", "validation"],
    },
    "target-valibot": {
        "description": "Valibot schemas generated from live Postgres by supawatch, mapped to what the driver actually returns.",
        "keywords": BASE_KEYWORDS + ["valibot", "validation"],
    },
    "target-arktype": {
        "description": "ArkType types generated from live Postgres by supawatch, mapped to what the driver actually returns.",
        "keywords": BASE_KEYWORDS + ["arktype", "validation"],
    },
    "target-typebox": {
        "description": "TypeBox schemas generated from live Postgres by supawatch, mapped to what the driver actually returns.",
        "keywords": BASE_KEYWORDS + ["typebox", "json-schema", "validation"],
    },
    "target-supabase-types": {
        "description": "A supabase-js compatible Database interface generated from live Postgres by supawatch, foreign-key relationships included.",
        "keywords": BASE_KEYWORDS + ["supabase-js", "database-types", "gen-types"],
    },
    "verify": {
        "description": "The supawatch verification harness: ground truth against real rows, cross-target parity, and a must-fire divergence ledger.",
        "keywords": BASE_KEYWORDS + ["pglite", "testing", "verification"],
    },
}

for name, meta in META.items():
    p = root / "packages" / name / "package.json"
    data = json.loads(p.read_text())
    out = {}
    for k, v in data.items():
        out[k] = v
        if k == "version":
            out["description"] = meta["description"]
            out["keywords"] = meta["keywords"]
    # drop stale copies if the key existed later in the object
    p.write_text(json.dumps(out, indent=2) + "\n")
    print(name, "ok")
