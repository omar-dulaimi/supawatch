import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readDotEnvDatabaseUrl } from "supawatch";

describe("DATABASE_URL fallback from ./.env", () => {
  it("reads plain, quoted, and absent values", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "dotenv-"));
    try {
      expect(readDotEnvDatabaseUrl(dir)).toBeUndefined();

      await writeFile(
        path.join(dir, ".env"),
        [
          "# comment",
          "OTHER=1",
          'DATABASE_URL="postgres://a:b@localhost:5499/db"',
          "",
        ].join("\n"),
      );
      expect(readDotEnvDatabaseUrl(dir)).toBe("postgres://a:b@localhost:5499/db");

      await writeFile(
        path.join(dir, ".env"),
        "DATABASE_URL=postgres://plain@localhost/db\n",
      );
      expect(readDotEnvDatabaseUrl(dir)).toBe("postgres://plain@localhost/db");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
