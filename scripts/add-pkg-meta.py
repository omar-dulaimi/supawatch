import json
import pathlib

root = pathlib.Path(__file__).resolve().parent.parent
for p in sorted((root / "packages").glob("*/package.json")):
    data = json.loads(p.read_text())
    out = {}
    for k, v in data.items():
        out[k] = v
        if k == "version" and "license" not in data:
            out["license"] = "MIT"
            out["author"] = "Omar Dulaimi"
            out["repository"] = {
                "type": "git",
                "url": "git+https://github.com/omar-dulaimi/supawatch.git",
                "directory": f"packages/{p.parent.name}",
            }
    p.write_text(json.dumps(out, indent=2) + "\n")
    print(p.parent.name, "ok")
