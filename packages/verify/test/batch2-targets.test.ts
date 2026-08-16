import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { initTRPC } from "@trpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assemble, introspect, type Querier, type Snapshot } from "@supawatch/core";
import { FormsTarget } from "@supawatch/target-forms";
import { FactoriesTarget } from "@supawatch/target-factories";
import { TrpcTarget } from "@supawatch/target-trpc";
import { ZodTarget } from "@supawatch/target-zod";
import { FIXTURE_SQL } from "@supawatch/verify";

const HERE = path.dirname(fileURLToPath(import.meta.url));

function querierFromPglite(db: PGlite): Querier {
  return async <T = Record<string, unknown>>(text: string, params?: unknown[]) => {
    const result = await db.query<Record<string, unknown>>(text, params as unknown[]);
    return result.rows.map((row) => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        out[k] = typeof v === "bigint" ? v.toString() : v;
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

describe("forms target", () => {
  it("derives controls, requiredness, and enum options; excludes server-owned columns", () => {
    const table = snapshot.tables.find((t) => t.name === "parcels")!;
    const rendered = new FormsTarget().renderTable(table, snapshot, {});
    const fields = JSON.parse(
      rendered.body.replace(/^export const \w+ = /, "").replace(/;$/, ""),
    ) as { name: string; control: string; required: boolean; options?: string[] }[];

    const byName = Object.fromEntries(fields.map((f) => [f.name, f]));
    expect(byName.state.control).toBe("select");
    expect(byName.state.options).toEqual(["queued", "shipped", "lost"]);
    expect(byName.state.required).toBe(false); // has a default
    expect(byName.active.control).toBe("checkbox");
    expect(byName.shipped_on.control).toBe("date");
    expect(byName.note.required).toBe(false); // nullable
    // id is a serial with a default: present but optional
    expect(byName.id.required).toBe(false);
  });
});

describe("factories target cross-checked against the zod target", () => {
  it("every factory's default row satisfies the generated zod schema", async () => {
    const factories = new FactoriesTarget();
    const zod = new ZodTarget();
    const dir = await mkdtemp(path.join(HERE, "factories-"));
    try {
      for (const table of snapshot.tables) {
        const f = factories.renderTable(table, snapshot, {});
        const z = zod.renderTable(table, snapshot, { strict: true });
        const fFile = path.join(dir, `${table.name}.factory.mjs`);
        const zFile = path.join(dir, `${table.name}.zod.mjs`);
        await writeFile(fFile, assemble(f));
        await writeFile(zFile, assemble(z));
        const fMod = await import(`file://${fFile}`);
        const zMod = await import(`file://${zFile}`);
        const row = fMod[f.exportName]();
        const verdict = zMod[z.exportName].safeParse(row);
        expect(
          verdict.success,
          `${table.name}: ${verdict.success ? "" : verdict.error.issues[0]?.message}`,
        ).toBe(true);
        // overrides merge
        const custom = fMod[f.exportName]({ note: "custom" });
        expect(custom.note).toBe("custom");
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("trpc target with a real initTRPC router against real rows", () => {
  it("list and byId return parsed rows; create validates input", async () => {
    const trpc = new TrpcTarget();
    const zod = new ZodTarget();
    const table = snapshot.tables.find((t) => t.name === "parcels")!;
    const dir = await mkdtemp(path.join(HERE, "trpc-"));
    try {
      await rm(path.join(dir, "zod"), { recursive: true, force: true });
      const zDir = path.join(dir, "zod");
      const tDir = path.join(dir, "trpc");
      const { mkdir } = await import("node:fs/promises");
      await mkdir(zDir, { recursive: true });
      await mkdir(tDir, { recursive: true });

      const z = zod.renderTable(table, snapshot, {
        strict: true,
        emit: { insert: true },
      });
      await writeFile(path.join(zDir, "parcels.mjs"), assemble(z));
      const r = trpc.renderTable(table, snapshot, { schemasImportPath: "../zod" });
      await writeFile(path.join(tDir, "parcels.mjs"), assemble(r));

      const mod = await import(`file://${path.join(tDir, "parcels.mjs")}`);
      const t = initTRPC.create();
      const query = querierFromPglite(db);
      const sqlAdapter = { unsafe: (text: string, params?: unknown[]) => query(text, params) };
      const router = mod[r.exportName](t, sqlAdapter);
      const caller = t.createCallerFactory(router)({});

      const rows = await caller.list();
      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0].tracking).toBeDefined();

      const one = await caller.byId({ id: rows[0].id });
      expect(one?.id).toBe(rows[0].id);

      await expect(
        caller.create({ price: "not validating the wrong shape" }),
      ).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
