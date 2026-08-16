import pathlib

root = pathlib.Path(__file__).resolve().parent.parent
p = root / "packages/target-supabase-types/src/index.ts"
s = p.read_text()
s = s.replace(
    '      lines.push("    Functions: Record<string, never>;");',
    """      const fns = snapshot.functions.filter((f) => f.schema === schema);
      if (fns.length === 0) {
        lines.push("    Functions: Record<string, never>;");
      } else {
        lines.push("    Functions: {");
        for (const fn of fns) {
          lines.push(`      ${fn.name}: {`);
          if (fn.args.length === 0) {
            lines.push("        Args: Record<string, never>;");
          } else {
            lines.push("        Args: {");
            for (const arg of fn.args) {
              const t = tsType(
                runtimeFor(arg.pgTypeName, "b", { enums: snapshot.enums }, "supabase-js"),
                "Json",
              );
              lines.push(`          ${arg.name}${arg.hasDefault ? "?" : ""}: ${t};`);
            }
            lines.push("        };");
          }
          const ret = tsType(
            runtimeFor(fn.returns.pgTypeName, "b", { enums: snapshot.enums }, "supabase-js"),
            "Json",
          );
          lines.push(`        Returns: ${fn.returns.isSet ? `(${ret})[]` : ret};`);
          lines.push("      };");
        }
        lines.push("    };");
      }""",
)
p.write_text(s)
print("bridge functions ok")
