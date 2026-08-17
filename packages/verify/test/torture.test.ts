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

describe("torture 2: hostile relations and seeds", () => {
  it("zero-column tables and unpopulated matviews survive a full run", async () => {
    const edge = new PGlite();
    await edge.exec(`
      create table nothing_here ();
      create table things (id serial primary key, name text not null);
      insert into things (name) values ('x');
      create materialized view ghost as select name from things with no data;
    `);
    const q = querierFromPglite(edge);
    const snap = await introspect(q);
    expect(snap.tables.find((t) => t.name === "nothing_here")?.kind).toBe("table");
    expect(snap.tables.find((t) => t.name === "ghost")?.kind).toBe("view");

    const dir = await mkdtemp(path.join(path.dirname(fileURLToPath(import.meta.url)), "edge-"));
    const logs: string[] = [];
    try {
      const watcher = new Watcher({
        query: q,
        schemas: ["public"],
        targets: [{ target: new ZodTarget(), options: {}, outDir: dir }],
        source: manualSource(),
        log: (m: string) => logs.push(m),
      });
      await watcher.runOnce();
      expect(logs.join("\n")).toContain("ghost: skipped (materialized view not populated)");
    } finally {
      await rm(dir, { recursive: true, force: true });
      await edge.close();
    }
  });

  it("a column named __proto__ fails loudly instead of corrupting schemas", async () => {
    const evil = new PGlite();
    await evil.exec('create table t (id serial primary key, "__proto__" text)');
    const dir = await mkdtemp(path.join(tmpdir(), "proto-"));
    try {
      const watcher = new Watcher({
        query: querierFromPglite(evil),
        schemas: ["public"],
        targets: [{ target: new ZodTarget(), options: {}, outDir: dir }],
        source: manualSource(),
        verifyRows: false,
        log: () => {},
      });
      await expect(watcher.runOnce()).rejects.toThrow(/__proto__/);
    } finally {
      await rm(dir, { recursive: true, force: true });
      await evil.close();
    }
  });

  it("a table named index fails loudly instead of losing to the barrel", async () => {
    const clash = new PGlite();
    await clash.exec('create table "index" (id serial primary key)');
    const dir = await mkdtemp(path.join(tmpdir(), "idxclash-"));
    try {
      const watcher = new Watcher({
        query: querierFromPglite(clash),
        schemas: ["public"],
        targets: [{ target: new ZodTarget(), options: {}, outDir: dir }],
        source: manualSource(),
        verifyRows: false,
        log: () => {},
      });
      await expect(watcher.runOnce()).rejects.toThrow(/barrel's own file name/);
    } finally {
      await rm(dir, { recursive: true, force: true });
      await clash.close();
    }
  });

  it("seed honors soft FK order, refuses non-pk references and constrained text types, caps char lengths", async () => {
    const { SeedTarget } = await import("@supawatch/target-seed");
    const dbb = new PGlite();
    await dbb.exec(`
      create table zz_parents (id serial primary key, label text not null);
      create table aa_children (
        id serial primary key,
        parent_id int references zz_parents(id)
      );
      create table registry (id serial primary key, email text not null unique);
      create table subs (id serial primary key, target_email text not null references registry(email));
      create table nets (id serial primary key, ip inet not null, tag varchar(4) not null);
    `);
    const snap = await introspect(querierFromPglite(dbb));
    const sql = new SeedTarget().renderSnapshot(snap, { rows: 2 })[0].content;

    // nullable FK still orders parent first (soft edge, honored)
    expect(sql.indexOf('"zz_parents"')).toBeLessThan(sql.indexOf('"aa_children"'));
    // FK to a unique non-pk column is refused with the reason
    expect(sql).toContain(
      "-- skipped public.subs: foreign key target_email references registry(email), not its primary key",
    );
    // inet is string-at-runtime but not free text; required means skip
    expect(sql).toContain("no honest value for ip (inet)");
    // varchar(4) placeholder respects the declared cap
    const tag = /"tag"\) values \(\d+, '([^']*)'/.exec(sql)?.[1];
    expect(tag).toBeUndefined(); // nets skipped entirely for ip

    // the file must apply to the real database
    await dbb.exec(sql);
    const q = querierFromPglite(dbb);
    const [{ n }] = await q<{ n: unknown }>("select count(*)::int as n from aa_children");
    expect(Number(n)).toBe(2);
    await dbb.close();
  });

  it("caps free-text placeholders to declared char lengths", async () => {
    const { SeedTarget } = await import("@supawatch/target-seed");
    const dbc = new PGlite();
    await dbc.exec("create table caps (id serial primary key, tag varchar(4) not null, fixed char(3) not null)");
    const snap = await introspect(querierFromPglite(dbc));
    const sql = new SeedTarget().renderSnapshot(snap, { rows: 1 })[0].content;
    await dbc.exec(sql);
    const q = querierFromPglite(dbc);
    const [row] = await q<{ tag: string; fixed: string }>("select tag, fixed from caps");
    expect(row.tag.length).toBeLessThanOrEqual(4);
    expect(row.fixed.length).toBeLessThanOrEqual(3);
    await dbc.close();
  });

  it("excludes trigger-returning functions from the snapshot", async () => {
    const dbf = new PGlite();
    await dbf.exec(`
      create table t (id int);
      create function normal_fn(x int) returns int language sql as 'select x';
      create function trg_fn() returns trigger language plpgsql as $$ begin return new; end $$;
    `);
    const snap = await introspect(querierFromPglite(dbf));
    const names = snap.functions.map((f) => f.name);
    expect(names).toContain("normal_fn");
    expect(names).not.toContain("trg_fn");
    await dbf.close();
  });
});

describe("torture 3: pathological values, degenerate types, hostile names", () => {
  it("a NOT NULL zero-label enum column fails loudly", async () => {
    const dbe = new PGlite();
    await dbe.exec("create type nada as enum (); create table t (id serial primary key, phase nada not null)");
    const dir = await mkdtemp(path.join(tmpdir(), "nada-"));
    try {
      const watcher = new Watcher({
        query: querierFromPglite(dbe),
        schemas: ["public"],
        targets: [{ target: new ZodTarget(), options: {}, outDir: dir }],
        source: manualSource(),
        verifyRows: false,
        log: () => {},
      });
      await expect(watcher.runOnce()).rejects.toThrow(/zero labels and is NOT NULL/);
    } finally {
      await rm(dir, { recursive: true, force: true });
      await dbe.close();
    }
  });

  it("a relation name containing a newline fails loudly (ESM strips it from import URLs)", async () => {
    const dbn = new PGlite();
    await dbn.exec('create table "line\nbreak" (id serial primary key)');
    const dir = await mkdtemp(path.join(tmpdir(), "nl-"));
    try {
      const watcher = new Watcher({
        query: querierFromPglite(dbn),
        schemas: ["public"],
        targets: [{ target: new ZodTarget(), options: {}, outDir: dir }],
        source: manualSource(),
        verifyRows: false,
        log: () => {},
      });
      await expect(watcher.runOnce()).rejects.toThrow(/control character/);
    } finally {
      await rm(dir, { recursive: true, force: true });
      await dbn.close();
    }
  });

  it("dotted schema and table names that collide on one file fail loudly", async () => {
    const dbd = new PGlite();
    await dbd.exec(`
      create schema "a.b";
      create schema a;
      create table "a.b".c (id serial primary key);
      create table a."b.c" (id serial primary key);
    `);
    const dir = await mkdtemp(path.join(tmpdir(), "dotted-"));
    try {
      const watcher = new Watcher({
        query: querierFromPglite(dbd),
        schemas: ["a.b", "a"],
        targets: [{ target: new ZodTarget(), options: {}, outDir: dir }],
        source: manualSource(),
        verifyRows: false,
        log: () => {},
      });
      await expect(watcher.runOnce()).rejects.toThrow(/both emit the file "a\.b\.c/);
    } finally {
      await rm(dir, { recursive: true, force: true });
      await dbd.close();
    }
  });

  it("seed refuses unpredictable primary keys and their children by name", async () => {
    const { SeedTarget } = await import("@supawatch/target-seed");
    const dbs = new PGlite();
    await dbs.exec(`
      create table gen_parents (
        src int not null,
        id int generated always as (src * 10) stored primary key
      );
      create table gen_children (
        id serial primary key,
        parent_id int not null references gen_parents(id)
      );
      create table clocked (span interval primary key, note text);
    `);
    const snap = await introspect(querierFromPglite(dbs));
    const sql = new SeedTarget().renderSnapshot(snap, { rows: 2 })[0].content;
    expect(sql).toContain('insert into "public"."gen_parents"');
    expect(sql).toContain(
      "-- skipped public.gen_children: foreign key parent_id references gen_parents, whose primary key values the generator cannot predict",
    );
    expect(sql).toContain(
      "-- skipped public.clocked: primary key span has no honest literal (interval)",
    );
    await dbs.exec(sql); // gen_parents rows compute their own ids
    const q = querierFromPglite(dbs);
    const [{ n }] = await q<{ n: unknown }>("select count(*)::int as n from gen_parents");
    expect(Number(n)).toBe(2);
    await dbs.close();
  });
});

describe("the ERD parses under real mermaid, hostile names included", () => {
  it("hostile identifiers render as aliases and the diagram parses; the raw form must fail", async () => {
    const { JSDOM } = await import("jsdom");
    const dom = new JSDOM("<!DOCTYPE html><body></body>");
    (globalThis as Record<string, unknown>).window = dom.window;
    (globalThis as Record<string, unknown>).document = dom.window.document;
    Object.defineProperty(globalThis, "navigator", {
      value: dom.window.navigator,
      configurable: true,
    });
    const mermaid = (await import("mermaid")).default;

    const dbh = new PGlite();
    await dbh.exec(`
      create schema aux;
      create table "users; drop table users--" (
        id serial primary key,
        "'); delete from x; --" text,
        "café" text,
        "0" text,
        "1e3" text
      );
      create table "Order Log" (id serial primary key, "weird name" text);
      create table settings (key text primary key);
      create table aux.settings (key text primary key);
      create table notes (
        id serial primary key,
        log_id int not null references "Order Log"(id)
      );
    `);
    const snap = await introspect(querierFromPglite(dbh), ["public", "aux"]);
    const { ErdTarget } = await import("@supawatch/target-erd");
    const [file] = new ErdTarget().renderSnapshot(snap, {});
    const body = file.content
      .split("```mermaid\n")[1]
      .split("\n```")[0];

    const verdict = await mermaid.parse(body, { suppressErrors: true });
    expect(verdict).toBeTruthy();
    // display aliases carry the real names
    expect(body).toContain('["public.users; drop table users--"]');
    expect(body).toContain('"column: \'); delete from x; --"');
    // same-named tables across schemas stay distinct entities
    expect(body).toContain("public_settings");
    expect(body).toContain("aux_settings");

    // must-fire control: the checker really detects broken diagrams
    const broken = "erDiagram\n  users; drop table users-- { int id }";
    expect(await mermaid.parse(broken, { suppressErrors: true })).toBe(false);

    await dbh.close();
  });

  it("stays under Mermaid's render limit by trimming attributes, and says so", async () => {
    // Mermaid refuses to RENDER past 50000 characters (MAX_TEXTLENGTH in
    // its source) and swaps in an error box; parse does not check size at
    // all, so a diagram can parse and still be undisplayable.
    const big = new PGlite();
    await big.exec(`
      do $$
      declare i int;
      declare j int;
      declare cols text;
      begin
        for i in 1..70 loop
          cols := '';
          for j in 1..60 loop
            cols := cols || format('descriptive_column_name_%s text,', j);
          end loop;
          execute format('create table wide_%s (%s id serial primary key)', i, cols);
        end loop;
      end $$;
    `);
    const snap = await introspect(querierFromPglite(big));
    const { ErdTarget } = await import("@supawatch/target-erd");

    const [auto] = new ErdTarget().renderSnapshot(snap, {});
    const autoBody = auto.content.split("```mermaid\n")[1].split("\n```")[0];
    expect(autoBody.length).toBeLessThanOrEqual(50000);
    expect(auto.content).toContain("exceeds Mermaid's 50000 character render limit");
    expect(auto.content).toContain("key columns only");

    // an explicit choice is honored, with an honest warning when it will
    // not render
    const [forced] = new ErdTarget().renderSnapshot(snap, { attributes: "all" });
    const forcedBody = forced.content.split("```mermaid\n")[1].split("\n```")[0];
    expect(forcedBody.length).toBeGreaterThan(50000);
    expect(forced.content).toContain("Maximum text size in diagram exceeded");

    // a raised budget keeps every column and emits no note
    const [raised] = new ErdTarget().renderSnapshot(snap, { maxTextSize: 500000 });
    expect(raised.content).not.toContain("[!NOTE]");
    expect(raised.content).not.toContain("[!WARNING]");

    await big.close();
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
