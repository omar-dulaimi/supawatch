import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assemble, introspect, type Querier, type Snapshot } from "@supawatch/core";
import { ErdTarget } from "@supawatch/target-erd";
import { SchemaLockTarget } from "@supawatch/target-schema-lock";
import { JsonSchemaTarget } from "@supawatch/target-json-schema";
import { FastCheckTarget } from "@supawatch/target-fast-check";
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

beforeAll(async () => {
  db = new PGlite();
  await db.exec(FIXTURE_SQL);
  snapshot = await introspect(querierFromPglite(db));
});

afterAll(async () => {
  await db.close();
});

describe("erd target", () => {
  it("emits a mermaid diagram with entities, PK markers, and FK edges", () => {
    const [file] = new ErdTarget().renderSnapshot(snapshot, {});
    expect(file.file).toBe("schema.erd.md");
    expect(file.content).toContain("```mermaid");
    expect(file.content).toContain("erDiagram");
    expect(file.content).toContain("parcels {");
    expect(file.content).toContain("int4 id PK");
    // the fixture view appears as an entity too
    expect(file.content).toContain("lost_parcels {");
  });
});

describe("schema-lock target", () => {
  it("is canonical: identical schema produces identical bytes", async () => {
    const a = new SchemaLockTarget().renderSnapshot(snapshot, {})[0];
    const again = await introspect(querierFromPglite(db));
    const b = new SchemaLockTarget().renderSnapshot(again, {})[0];
    expect(a.content).toBe(b.content);
    const parsed = JSON.parse(a.content);
    expect(parsed.format).toBe(1);
    expect(parsed.tables.some((t: { name: string }) => t.name === "parcels")).toBe(true);
  });
});

describe("json-schema target with its Ajv verifier", () => {
  it("ground truth: real rows pass; wrong kinds and extra keys fail", async () => {
    const target = new JsonSchemaTarget();
    const table = snapshot.tables.find((t) => t.name === "parcels")!;
    const rendered = target.renderTable(table, snapshot, { strict: true });
    const dir = await mkdtemp(path.join(HERE, "jsonschema-"));
    try {
      const file = path.join(dir, "parcels.schema.json");
      await writeFile(file, target.assembleFile(rendered));

      const verifier = target.verifier();
      const schema = await verifier.load(file, rendered.exportName);
      const rows = await querierFromPglite(db)("select * from parcels limit 10");
      for (const row of rows) {
        const verdict = verifier.check(schema, row);
        expect(verdict.ok, verdict.reason).toBe(true);
      }

      const base = rows[0] as Record<string, unknown>;
      expect(verifier.check(schema, { ...base, small: "42" }).ok).toBe(false);
      expect(verifier.check(schema, { ...base, state: "not_a_label" }).ok).toBe(false);
      expect(verifier.check(schema, { ...base, extra_key: 1 }).ok).toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("fast-check target cross-checked against the zod target", () => {
  it("every generated arbitrary satisfies the generated zod schema", async () => {
    const fcTarget = new FastCheckTarget();
    const zodTarget = new ZodTarget();
    const dir = await mkdtemp(path.join(HERE, "fastcheck-"));
    try {
      for (const table of snapshot.tables) {
        const arbRendered = fcTarget.renderTable(table, snapshot, {});
        const zodRendered = zodTarget.renderTable(table, snapshot, { strict: true });
        const arbFile = path.join(dir, `${table.name}.arb.mjs`);
        const zodFile = path.join(dir, `${table.name}.zod.mjs`);
        await writeFile(arbFile, assemble(arbRendered));
        await writeFile(zodFile, assemble(zodRendered));

        const arbMod = await import(`file://${arbFile}`);
        const zodMod = await import(`file://${zodFile}`);
        const arb = arbMod[arbRendered.exportName];
        const schema = zodMod[zodRendered.exportName];

        fc.assert(
          fc.property(arb, (row: unknown) => {
            const v = schema.safeParse(row);
            if (!v.success) {
              throw new Error(
                `${table.name}: arbitrary produced a row zod rejects: ${v.error.issues[0]?.message}`,
              );
            }
          }),
          { numRuns: 25 },
        );
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 60000);

  it("emits a typed declaration companion", () => {
    const table = snapshot.tables.find((t) => t.name === "parcels")!;
    const types = new FastCheckTarget().renderTypes!(table, snapshot, {});
    expect(types).toContain("Arbitrary<parcelsArbRow>");
  });
});

describe("core primary keys", () => {
  it("introspects the primary key column list", () => {
    const parcels = snapshot.tables.find((t) => t.name === "parcels")!;
    expect(parcels.primaryKey).toEqual(["id"]);
    const view = snapshot.tables.find((t) => t.name === "lost_parcels")!;
    expect(view.primaryKey).toEqual([]);
  });
});

// keep the linter honest about the unused import style in this file
void readFile;
