import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Emitted files must resolve "zod" the way a consumer's project would, so
// the temp dir lives inside this package rather than in /tmp.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const tmpdir = () => HERE;
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Querier } from "@supawatch/core";
import { ZodTarget } from "@supawatch/target-zod";
import { manualSource, Watcher } from "@supawatch/watch";

// Same PGlite adapter as core's tests; duplicated four lines rather than
// creating a cross-package test dependency.
function querierFromPglite(db: PGlite): Querier {
  return async <T = Record<string, unknown>>(text: string, params?: unknown[]) => {
    const result = await db.query<T>(text, params as unknown[]);
    return result.rows;
  };
}

let db: PGlite;
let dir: string;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create table things (
      id serial primary key,
      label text not null,
      price numeric(8,2)
    );
    insert into things (label, price) values ('a', '1.50'), ('b', null);
  `);
  dir = await mkdtemp(path.join(tmpdir(), "supawatch-watch-"));
});

afterAll(async () => {
  await db.close();
  await rm(dir, { recursive: true, force: true });
});

describe("Watcher cycle against real Postgres (PGlite)", () => {
  it("baseline generates, verifies real rows, then reacts to DDL", async () => {
    const logs: string[] = [];
    const watcher = new Watcher({
      query: querierFromPglite(db),
      targets: [{ target: new ZodTarget(), options: { strict: true }, outDir: dir }],
      source: manualSource(),
      log: (m) => logs.push(m),
    });

    const baseline = await watcher.runOnce();
    expect(baseline.files.some((f) => f.endsWith("things.mjs"))).toBe(true);
    expect(baseline.verified).toEqual([
      { table: "things", rows: 2, passed: 2, reasons: [] },
    ]);

    const emitted = await readFile(path.join(dir, "things.mjs"), "utf8");
    expect(emitted).toContain('"price": z.string().nullable()');

    await db.exec("alter table things add column tag text");
    const second = await watcher.runOnce();
    expect(second.changes).toEqual([
      "public.things gained tag (text, nullable)",
    ]);
    expect(second.verified[0].passed).toBe(second.verified[0].rows);

    const regenerated = await readFile(path.join(dir, "things.mjs"), "utf8");
    expect(regenerated).toContain('"tag": z.string().nullable()');
  });

  it("ships a declaration barrel beside the runtime barrel", async () => {
    const dirB = await mkdtemp(path.join(tmpdir(), "barrel-"));
    try {
      const watcher = new Watcher({
        query: querierFromPglite(db),
        targets: [{ target: new ZodTarget(), options: {}, outDir: dirB }],
        source: manualSource(),
        log: () => {},
      });
      await watcher.runOnce();
      const entries = await readdir(dirB);
      expect(entries).toContain("index.mjs");
      // Without this, a strict-TS consumer cannot type barrel imports;
      // found by dogfooding against the published package.
      expect(entries).toContain("index.d.mts");
      const decl = await readFile(path.join(dirB, "index.d.mts"), "utf8");
      expect(decl).toContain('export * from "./things.mjs";');
    } finally {
      await rm(dirB, { recursive: true, force: true });
    }
  });

  it("prunes files for dropped tables, types companion included", async () => {
    await db.exec("create table doomed (id serial primary key)");
    const watcher = new Watcher({
      query: querierFromPglite(db),
      targets: [{ target: new ZodTarget(), options: {}, outDir: dir }],
      source: manualSource(),
      log: () => {},
    });
    await watcher.runOnce();
    let entries = await readdir(dir);
    expect(entries).toContain("doomed.mjs");
    expect(entries).toContain("doomed.d.mts");

    await db.exec("drop table doomed");
    await watcher.runOnce();
    entries = await readdir(dir);
    expect(entries).not.toContain("doomed.mjs");
    expect(entries).not.toContain("doomed.d.mts");
  });

  it("prefixes filenames with the schema when several schemas are watched", async () => {
    await db.exec(`
      create schema other;
      create table other.things (id serial primary key, label text not null);
      insert into other.things (label) values ('x');
    `);
    const dir2 = await mkdtemp(path.join(tmpdir(), "multi-"));
    try {
      const watcher = new Watcher({
        query: querierFromPglite(db),
        schemas: ["public", "other"],
        targets: [{ target: new ZodTarget(), options: {}, outDir: dir2 }],
        source: manualSource(),
        log: () => {},
      });
      await watcher.runOnce();
      const entries = await readdir(dir2);
      expect(entries).toContain("public.things.mjs");
      expect(entries).toContain("other.things.mjs");
      expect(entries).not.toContain("things.mjs");
    } finally {
      await rm(dir2, { recursive: true, force: true });
      await db.exec("drop schema other cascade");
    }
  });

  it("a LISTEN reconnect wakes the watcher, the first ready does not", async () => {
    const { listenSource } = await import("@supawatch/watch");
    let captured: { onListen?: () => void } = {};
    const fakeSql = {
      listen: async (
        _ch: string,
        _onNotify: (x: string) => void,
        onListen?: () => void,
      ) => {
        captured.onListen = onListen;
        return { unlisten: async () => {} };
      },
    } as unknown as import("postgres").Sql;

    const wakes: string[] = [];
    const source = listenSource(fakeSql);
    await source.start((hint) => wakes.push(hint));

    captured.onListen!();
    expect(wakes).toEqual([]);
    captured.onListen!();
    captured.onListen!();
    expect(wakes).toEqual(["listen-reconnect", "listen-reconnect"]);
  });

  it("skips regeneration when a wake finds no structural change", async () => {
    const watcher = new Watcher({
      query: querierFromPglite(db),
      targets: [{ target: new ZodTarget(), options: {}, outDir: dir }],
      source: manualSource(),
      log: () => {},
    });
    await watcher.runOnce();
    const noop = await watcher.runOnce();
    expect(noop.changes).toEqual([]);
    expect(noop.files).toEqual([]);
  });
});
