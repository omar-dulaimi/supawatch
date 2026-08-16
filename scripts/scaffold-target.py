import json
import pathlib
import sys

root = pathlib.Path(__file__).resolve().parent.parent
name = sys.argv[1]
extra_deps = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
extra_peers = json.loads(sys.argv[3]) if len(sys.argv) > 3 else {}

pkg = root / "packages" / name
(pkg / "src").mkdir(parents=True, exist_ok=True)

manifest = {
    "name": f"@supawatch/{name}",
    "version": json.loads((root / "packages" / "core" / "package.json").read_text())["version"],
    "license": "MIT",
    "author": "Omar Dulaimi",
    "repository": {
        "type": "git",
        "url": "git+https://github.com/omar-dulaimi/supawatch.git",
        "directory": f"packages/{name}",
    },
    "type": "module",
    "main": "./dist/index.js",
    "types": "./dist/index.d.ts",
    "exports": {".": {"types": "./dist/index.d.ts", "default": "./dist/index.js"}},
    "files": ["dist"],
    "scripts": {"build": "tsc -p tsconfig.json"},
    "dependencies": {"@supawatch/core": "workspace:*", **extra_deps},
    "devDependencies": {"@types/node": "^22.20.1", "typescript": "^5.9.0"},
}
if extra_peers:
    manifest["peerDependencies"] = extra_peers
    manifest["devDependencies"].update(extra_peers)

(pkg / "package.json").write_text(json.dumps(manifest, indent=2) + "\n")
(pkg / "tsconfig.json").write_text(
    json.dumps(
        {
            "extends": "../../tsconfig.base.json",
            "compilerOptions": {"outDir": "dist", "rootDir": "src"},
            "include": ["src"],
        },
        indent=2,
    )
    + "\n"
)
print(name, "scaffolded")
