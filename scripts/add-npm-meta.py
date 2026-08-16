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
    "target-erd": {
        "description": "A Mermaid ER diagram generated from live Postgres by supawatch, kept current on every schema change.",
        "keywords": BASE_KEYWORDS + ["mermaid", "erd", "diagram", "documentation"],
    },
    "target-schema-lock": {
        "description": "A canonical committed schema lockfile from supawatch, turning pull-request diffs into schema changelogs.",
        "keywords": BASE_KEYWORDS + ["lockfile", "drift", "ci"],
    },
    "target-json-schema": {
        "description": "Draft-07 JSON Schemas generated from live Postgres by supawatch, Ajv-verified against real rows.",
        "keywords": BASE_KEYWORDS + ["json-schema", "ajv", "validation", "openapi"],
    },
    "target-fast-check": {
        "description": "fast-check arbitraries generated from live Postgres by supawatch, producing rows shaped like real driver output.",
        "keywords": BASE_KEYWORDS + ["fast-check", "property-testing", "fuzzing", "testing"],
    },
    "target-forms": {
        "description": "Framework-agnostic form field configs generated from live Postgres by supawatch: controls, labels, requiredness, enum options.",
        "keywords": BASE_KEYWORDS + ["forms", "react-hook-form", "tanstack-form"],
    },
    "target-factories": {
        "description": "Typed fixture factories generated from live Postgres by supawatch, guaranteed to satisfy the generated Zod schemas.",
        "keywords": BASE_KEYWORDS + ["fixtures", "factories", "testing"],
    },
    "target-trpc": {
        "description": "tRPC routers generated from live Postgres by supawatch, input-validated by the generated Zod schemas.",
        "keywords": BASE_KEYWORDS + ["trpc", "router", "api"],
    },
    "target-schema-card": {
        "description": "A compact, token-lean schema card generated from live Postgres by supawatch for LLM prompts and agent context.",
        "keywords": BASE_KEYWORDS + ["llm", "prompt", "context", "ai"],
    },
    "target-dictionary": {
        "description": "A markdown data dictionary generated from live Postgres by supawatch, comments sourced from the database itself.",
        "keywords": BASE_KEYWORDS + ["data-dictionary", "documentation", "comments"],
    },
    "target-realtime": {
        "description": "Typed supabase-js realtime payload aliases generated from live Postgres by supawatch, shaped by the measured wire profile.",
        "keywords": BASE_KEYWORDS + ["realtime", "supabase-js", "payloads"],
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
