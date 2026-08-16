import pathlib

root = pathlib.Path(__file__).resolve().parent.parent
p = root / "packages/target-pgmq/src/index.ts"
s = p.read_text()
old_start = s.index("    for (const queue of queues) {")
old_end = s.index("    lines.push(\n      \"\",\n      `export const queues")
new_block = '''    for (const queue of queues) {
      const name = clientName(queue);
      // Queue names are generation-time constants; embed them as plain
      // SQL string literals in the emitted bodies.
      const qsql = "'" + queue.replace(/'/g, "''") + "'";
      lines.push(
        "",
        `export function ${name}(sql) {`,
        "  return {",
        "    async send(message, delaySeconds = 0) {",
        `      const rows = await sql.unsafe("select pgmq.send(${qsql}, $1::jsonb, $2::integer) as msg_id", [JSON.stringify(message), delaySeconds]);`,
        "      return rows[0].msg_id;",
        "    },",
        "    async read({ vt = 30, qty = 1 } = {}) {",
        `      return await sql.unsafe("select * from pgmq.read(${qsql}, $1::integer, $2::integer)", [vt, qty]);`,
        "    },",
        "    async pop() {",
        `      const rows = await sql.unsafe("select * from pgmq.pop(${qsql})");`,
        "      return rows[0] ?? null;",
        "    },",
        "    async archive(msgId) {",
        `      const rows = await sql.unsafe("select pgmq.archive(${qsql}, $1::bigint) as ok", [msgId]);`,
        "      return rows[0].ok === true;",
        "    },",
        "    async remove(msgId) {",
        `      const rows = await sql.unsafe("select pgmq.delete(${qsql}, $1::bigint) as ok", [msgId]);`,
        "      return rows[0].ok === true;",
        "    },",
        "  };",
        "}",
      );
    }
'''
s = s[:old_start] + new_block + s[old_end:]
p.write_text(s)
print("ok")
