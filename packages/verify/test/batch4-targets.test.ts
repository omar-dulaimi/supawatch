import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assemble, introspect, type Querier, type Snapshot } from "@supawatch/core";
import { McpTarget } from "@supawatch/target-mcp";
import { AiToolsTarget } from "@supawatch/target-ai-tools";
import { SupabaseTypesTarget } from "@supawatch/target-supabase-types";
import { ZodTarget } from "@supawatch/target-zod";
import { FIXTURE_SQL } from "@supawatch/verify";
import { parsePgTextArray } from "@supawatch/verify";

const HERE = path.dirname(fileURLToPath(import.meta.url));

function querierFromPglite(db: PGlite): Querier {
  return async <T = Record<string, unknown>>(text: string, params?: unknown[]) => {
    const result = await db.query<Record<string, unknown>>(text, params as unknown[]);
    return result.rows.map((row) => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        // enum-array-literal-vs-array delta: the fixture's enum-array
        // column arrives as the raw literal from PGlite.
        if (k === "states" && typeof v === "string") out[k] = parsePgTextArray(v);
        else out[k] = typeof v === "bigint" ? v.toString() : v;
      }
      return out;
    }) as T[];
  };
}

let db: PGlite;
let snapshot: Snapshot;
let dir: string;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(FIXTURE_SQL);
  await db.exec(`
    create function parcel_count(min_weight int4 default 0)
    returns int4 language sql stable
    as 'select count(*)::int4 from parcels where weight >= min_weight';
  `);
  snapshot = await introspect(querierFromPglite(db));

  dir = await mkdtemp(path.join(HERE, "batch4-"));
  const zod = new ZodTarget();
  await mkdir(path.join(dir, "zod"), { recursive: true });
  for (const table of snapshot.tables) {
    const r = zod.renderTable(table, snapshot, { strict: true });
    await writeFile(path.join(dir, "zod", `${table.name}.mjs`), assemble(r));
  }
});

afterAll(async () => {
  await db.close();
  await rm(dir, { recursive: true, force: true });
});

describe("functions facet", () => {
  it("introspects args, defaults, and return type", () => {
    const fn = snapshot.functions.find((f) => f.name === "parcel_count")!;
    expect(fn.args).toEqual([
      {
        name: "min_weight",
        pgTypeName: "int4",
        runtime: { kind: "number", integer: true },
        hasDefault: true,
      },
    ]);
    expect(fn.returns).toEqual({
      pgTypeName: "int4",
      runtime: { kind: "number", integer: true },
      isSet: false,
    });
  });

  it("fills the Database bridge Functions block", () => {
    const [file] = new SupabaseTypesTarget().renderSnapshot(snapshot, {});
    expect(file.content).toContain("parcel_count: {");
    expect(file.content).toContain("Args: { min_weight?: number };");
    expect(file.content).toContain("Returns: number;");
  });
});

describe("mcp target over a real client/server pair", () => {
  it("lists tools and calls list and get against real rows", async () => {
    const [file] = new McpTarget().renderSnapshot(snapshot, {
      schemasImportPath: "./zod",
    });
    const serverFile = path.join(dir, "mcp-server.mjs");
    await writeFile(serverFile, file.content);
    const mod = await import(`file://${serverFile}`);

    const query = querierFromPglite(db);
    const server = mod.createMcpServer({
      sql: { unsafe: (t: string, p?: unknown[]) => query(t, p) },
      name: "test-db",
      version: "0.0.1",
    });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test-client", version: "0.0.1" });
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const tools = await client.listTools();
    const names = tools.tools.map((t) => t.name);
    expect(names).toContain("parcels_list");
    expect(names).toContain("parcels_get");

    const listed = await client.callTool({
      name: "parcels_list",
      arguments: { limit: 5 },
    });
    const rows = JSON.parse(
      (listed.content as { type: string; text: string }[])[0].text,
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(typeof rows[0].price).toBe("string");

    const got = await client.callTool({
      name: "parcels_get",
      arguments: { id: rows[0].id },
    });
    const row = JSON.parse(
      (got.content as { type: string; text: string }[])[0].text,
    );
    expect(row.id).toBe(rows[0].id);

    await client.close();
    await server.close();
  }, 30000);
});

describe("ai-tools target executed directly", () => {
  it("tools carry inputSchema and execute against real rows", async () => {
    const [file] = new AiToolsTarget().renderSnapshot(snapshot, {
      schemasImportPath: "./zod",
    });
    const toolsFile = path.join(dir, "ai-tools.mjs");
    await writeFile(toolsFile, file.content);
    const mod = await import(`file://${toolsFile}`);

    const query = querierFromPglite(db);
    const tools = mod.createAiTools({
      sql: { unsafe: (t: string, p?: unknown[]) => query(t, p) },
    });

    expect(tools.parcels_list.inputSchema).toBeDefined();
    const rows = await tools.parcels_list.execute({ limit: 3 });
    expect(rows.length).toBeGreaterThan(0);
    const one = await tools.parcels_get.execute({ id: rows[0].id });
    expect(one.id).toBe(rows[0].id);
  });
});
