import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { exportBaseName, introspect, type Querier, type Snapshot } from "@supawatch/core";
import { SupabaseTypesTarget } from "@supawatch/target-supabase-types";
import { ZodTarget } from "@supawatch/target-zod";
import { RestTarget } from "@supawatch/target-rest";
import { Watcher, manualSource } from "@supawatch/watch";

// Advanced-schema regression suite, born from the torture round that
// found six real defects in one afternoon: invisible partitioned
// parents, invisible matviews, silently dropped ambiguous barrel
// exports, unquoted bridge keys, duplicate overloaded function keys,
// and the enum-array profile itself.

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
  await db.exec(`
    create table "Order Log" (
      id serial primary key,
      "select" text not null,
      "weird name" text,
      "café" text
    );
    create table measurements (
      city_id int not null,
      logdate date not null,
      peak numeric
    ) partition by range (logdate);
    create table measurements_y2026 partition of measurements
      for values from ('2026-01-01') to ('2027-01-01');
    create materialized view order_log_count as
      select count(*) as n from "Order Log";
    create function total_cost(x integer) returns integer
      language sql as 'select x';
    create function total_cost(x integer, y integer) returns integer
      language sql as 'select x + y';
    create schema app;
    create table app.settings (key text primary key, v text);
    create table settings (key text primary key, value text);
  `);
  snapshot = await introspect(querierFromPglite(db), ["public", "app"]);
});

afterAll(async () => {
  await db.close();
});

describe("advanced relations are visible, internals are not", () => {
  it("includes the partitioned parent and hides its partitions", () => {
    const names = snapshot.tables.map((t) => t.name);
    expect(names).toContain("measurements");
    expect(names).not.toContain("measurements_y2026");
    expect(snapshot.tables.find((t) => t.name === "measurements")?.kind).toBe("table");
  });

  it("includes materialized views as views", () => {
    const mv = snapshot.tables.find((t) => t.name === "order_log_count");
    expect(mv?.kind).toBe("view");
  });
});

describe("multi-schema export names", () => {
  it("prefixes the schema so same-named tables never collide", () => {
    const pub = snapshot.tables.find((t) => t.schema === "public" && t.name === "settings")!;
    const app = snapshot.tables.find((t) => t.schema === "app" && t.name === "settings")!;
    expect(exportBaseName(pub, snapshot)).toBe("public_settings");
    expect(exportBaseName(app, snapshot)).toBe("app_settings");
  });

  it("rest emitters import zod files by their prefixed file names", () => {
    const table = snapshot.tables.find((t) => t.schema === "app" && t.name === "settings")!;
    const rendered = new RestTarget().renderTable(table, snapshot, {});
    const zodImport = rendered.imports.find((i) => i.from.includes("app.settings"));
    expect(zodImport?.from).toBe("../zod/app.settings.mjs");
  });
});

describe("colliding sanitized names fail loudly, never silently", () => {
  it("the watcher refuses a barrel with ambiguous star exports", async () => {
    const dirty = new PGlite();
    await dirty.exec(`
      create table "a b" (id serial primary key, x text);
      create table "a-b" (id serial primary key, y text);
    `);
    const dir = await mkdtemp(path.join(tmpdir(), "collide-"));
    try {
      const watcher = new Watcher({
        query: querierFromPglite(dirty),
        schemas: ["public"],
        targets: [{ target: new ZodTarget(), options: {}, outDir: dir }],
        source: manualSource(),
        verifyRows: false,
        log: () => {},
      });
      await expect(watcher.runOnce()).rejects.toThrow(/both emit the export "a_bRow"/);
    } finally {
      await rm(dir, { recursive: true, force: true });
      await dirty.close();
    }
  });
});

describe("the Database bridge survives exotic identifiers and overloads", () => {
  it("quotes non-identifier keys and merges overloaded functions", () => {
    const [file] = new SupabaseTypesTarget().renderSnapshot(snapshot, {});
    expect(file.content).toContain('"Order Log": {');
    expect(file.content).toContain('"weird name": string | null;');
    expect(file.content).toContain('"café": string | null;');
    // reserved words are valid TS property names; no quoting needed
    expect(file.content).toContain("select: string;");
    // exactly one key for the overloaded name, signatures as unions
    expect(file.content.match(/total_cost: \{/g)).toHaveLength(1);
    expect(file.content).toContain(
      "Args: { x: number } | { x: number; y: number };",
    );
  });
});

describe("multi-schema watcher run stays coherent end to end", () => {
  it("emits prefixed files whose barrel re-exports prefixed names", async () => {
    // inside the repo so the generated module's zod import resolves
    const dir = await mkdtemp(path.join(path.dirname(fileURLToPath(import.meta.url)), "multi-"));
    try {
      const watcher = new Watcher({
        query: querierFromPglite(db),
        schemas: ["public", "app"],
        targets: [{ target: new ZodTarget(), options: {}, outDir: dir }],
        source: manualSource(),
        verifyRows: false,
        log: () => {},
      });
      await watcher.runOnce();
      const entries = await readdir(dir);
      expect(entries).toContain("public.settings.mjs");
      expect(entries).toContain("app.settings.mjs");
      const barrel = await readFile(path.join(dir, "index.mjs"), "utf8");
      expect(barrel).toContain('./public.settings.mjs');
      const mod = await import(`file://${path.join(dir, "public.settings.mjs")}`);
      expect(typeof mod.public_settingsRow?.parse).toBe("function");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
