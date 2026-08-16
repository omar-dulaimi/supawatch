import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assemble, introspect, type Querier, type Snapshot } from "@supawatch/core";
import { SeedTarget } from "@supawatch/target-seed";
import { ZodTarget } from "@supawatch/target-zod";

const HERE = path.dirname(fileURLToPath(import.meta.url));

// DDL-only fixture: seeds must land in an empty database. Covers the
// hard parts: identity-always parent, uuid parent, FK chains with a
// nullable edge, enums, arrays, defaults, and a generated column.
const DDL = `
create type ticket_state as enum ('open', 'closed');

create table owners (
  id uuid primary key,
  email text not null,
  joined date not null
);

create table projects (
  id bigint generated always as identity primary key,
  owner_id uuid not null references owners(id),
  name text not null,
  budget numeric(10,2),
  tags text[] not null default '{}'
);

create table tickets (
  id serial primary key,
  project_id bigint not null references projects(id),
  assignee_id uuid references owners(id),
  state ticket_state not null default 'open',
  title text not null,
  title_upper text generated always as (upper(title)) stored
);
`;

// PGlite returns SMALL int8 values as JS numbers and only large ones as
// BigInt, unlike postgres.js which always returns strings; found by this
// suite when a bigint identity id came back as the number 1. Normalizing
// to the postgres.js profile here needs the column list, so the second
// argument names the int8 columns per table when selecting *.
function querierFromPglite(db: PGlite, int8Columns: string[] = []): Querier {
  return async <T = Record<string, unknown>>(text: string, params?: unknown[]) => {
    const result = await db.query<Record<string, unknown>>(text, params as unknown[]);
    return result.rows.map((row) => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        if (typeof v === "bigint") out[k] = v.toString();
        else if (typeof v === "number" && int8Columns.includes(k)) out[k] = String(v);
        else out[k] = v;
      }
      return out;
    }) as T[];
  };
}

let db: PGlite;
let snapshot: Snapshot;
let seedSql: string;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(DDL);
  snapshot = await introspect(querierFromPglite(db));
  seedSql = new SeedTarget().renderSnapshot(snapshot, { rows: 3 })[0].content;
});

afterAll(async () => {
  await db.close();
});

describe("seed target against a real empty database", () => {
  it("orders parents before children and applies cleanly", async () => {
    const owners = seedSql.indexOf('"owners"');
    const projects = seedSql.indexOf('"projects"');
    const tickets = seedSql.indexOf('"tickets"');
    expect(owners).toBeGreaterThan(-1);
    expect(owners).toBeLessThan(projects);
    expect(projects).toBeLessThan(tickets);
    expect(seedSql).toContain("overriding system value");
    expect(seedSql).toContain("setval");

    await db.exec(seedSql);
    const query = querierFromPglite(db);
    const counts = await query<{ a: unknown; b: unknown; c: unknown }>(
      "select (select count(*) from owners) as a, (select count(*) from projects) as b, (select count(*) from tickets) as c",
    );
    expect([counts[0].a, counts[0].b, counts[0].c].map(Number)).toEqual([3, 3, 3]);
  });

  it("seeded rows satisfy the generated zod schemas (ground truth on seeds)", async () => {
    const dir = await mkdtemp(path.join(HERE, "seed-"));
    try {
      await mkdir(dir, { recursive: true });
      const zod = new ZodTarget();
      const query = querierFromPglite(db);
      for (const table of snapshot.tables) {
        const r = zod.renderTable(table, snapshot, { strict: true });
        const file = path.join(dir, `${table.name}.mjs`);
        await writeFile(file, assemble(r));
        const mod = await import(`file://${file}`);
        const int8Cols = table.columns
          .filter((c) => c.runtime.kind === "string" && c.runtime.format === "bigint")
          .map((c) => c.name);
        const tableQuery = querierFromPglite(db, int8Cols);
        const rows = await tableQuery(`select * from "${table.name}"`);
        for (const row of rows) {
          const v = mod[r.exportName].safeParse(row);
          expect(v.success, `${table.name}: ${v.success ? "" : v.error.issues[0]?.message}`).toBe(true);
        }
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("sequences are resynced: a post-seed insert does not collide", async () => {
    await db.exec(
      "insert into tickets (project_id, title) values (1, 'after seed')",
    );
    const query = querierFromPglite(db);
    const rows = await query<{ id: number }>(
      "select id from tickets order by id desc limit 1",
    );
    expect(Number(rows[0].id)).toBe(4);
  });

  it("is byte-deterministic for an unchanged schema", async () => {
    const again = new SeedTarget().renderSnapshot(snapshot, { rows: 3 })[0].content;
    expect(again).toBe(seedSql);
  });
});
