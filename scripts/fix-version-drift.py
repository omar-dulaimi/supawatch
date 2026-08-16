import json
import pathlib

root = pathlib.Path(__file__).resolve().parent.parent

core_v = json.loads((root / "packages/core/package.json").read_text())["version"]
for name in ["target-forms", "target-factories", "target-trpc"]:
    p = root / "packages" / name / "package.json"
    d = json.loads(p.read_text())
    d["version"] = core_v
    p.write_text(json.dumps(d, indent=2) + "\n")
    print(name, "->", core_v)

s = root / "scripts/scaffold-target.py"
t = s.read_text()
t = t.replace(
    '"version": "0.1.3",',
    '"version": json.loads((root / "packages" / "core" / "package.json").read_text())["version"],',
)
s.write_text(t)
print("scaffold version-aware")

d = root / "e2e/demo.sh"
t = d.read_text()
t = t.replace(
    'V=$(cd "$ROOT/packages/core" && node -p "require(\'./package.json\').version")\n',
    """pv() { node -p "require('$ROOT/packages/$1/package.json').version"; }
V=$(pv core)
V_ERD=$(pv target-erd); V_LOCK=$(pv target-schema-lock); V_JS=$(pv target-json-schema)
V_FC=$(pv target-fast-check); V_FORMS=$(pv target-forms); V_FACT=$(pv target-factories)
V_TRPC=$(pv target-trpc); V_ZOD=$(pv target-zod); V_VALI=$(pv target-valibot)
V_ARK=$(pv target-arktype); V_TB=$(pv target-typebox); V_ST=$(pv target-supabase-types)
V_WATCH=$(pv watch); V_CLI=$(pv cli)
""",
)
t = t.replace('"supawatch": "file:../tars/supawatch-${V}.tgz"', '"supawatch": "file:../tars/supawatch-${V_CLI}.tgz"')
t = t.replace('supawatch-target-arktype-${V}.tgz', 'supawatch-target-arktype-${V_ARK}.tgz')
t = t.replace('supawatch-target-erd-${V}.tgz', 'supawatch-target-erd-${V_ERD}.tgz')
t = t.replace('supawatch-target-schema-lock-${V}.tgz', 'supawatch-target-schema-lock-${V_LOCK}.tgz')
t = t.replace('supawatch-target-json-schema-${V}.tgz', 'supawatch-target-json-schema-${V_JS}.tgz')
t = t.replace('supawatch-target-fast-check-${V}.tgz', 'supawatch-target-fast-check-${V_FC}.tgz')
t = t.replace('supawatch-target-forms-${V}.tgz', 'supawatch-target-forms-${V_FORMS}.tgz')
t = t.replace('supawatch-target-factories-${V}.tgz', 'supawatch-target-factories-${V_FACT}.tgz')
t = t.replace('supawatch-target-trpc-${V}.tgz', 'supawatch-target-trpc-${V_TRPC}.tgz')
t = t.replace('supawatch-target-supabase-types-${V}.tgz', 'supawatch-target-supabase-types-${V_ST}.tgz')
t = t.replace('supawatch-target-typebox-${V}.tgz', 'supawatch-target-typebox-${V_TB}.tgz')
t = t.replace('supawatch-target-valibot-${V}.tgz', 'supawatch-target-valibot-${V_VALI}.tgz')
t = t.replace('supawatch-target-zod-${V}.tgz', 'supawatch-target-zod-${V_ZOD}.tgz')
t = t.replace('supawatch-watch-${V}.tgz', 'supawatch-watch-${V_WATCH}.tgz')
d.write_text(t)
print("e2e per-package versions")
