import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { call } from "@orpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assemble, introspect, type Querier, type Snapshot } from "@supawatch/core";
import { EffectTarget } from "@supawatch/target-effect";
import { RestTarget } from "@supawatch/target-rest";
import { ServiceTarget } from "@supawatch/target-service";
import { OrpcTarget } from "@supawatch/target-orpc";
import { GraphqlTarget } from "@supawatch/target-graphql";
import { PgtapTarget } from "@supawatch/target-pgtap";
import { RlsTarget } from "@supawatch/target-rls";
import { PgmqTarget } from "@supawatch/target-pgmq";
import { ZodTarget } from "@supawatch/target-zod";
import { ValibotTarget } from "@supawatch/target-valibot";
import { ArktypeTarget } from "@supawatch/target-arktype";
import { TypeboxTarget } from "@supawatch/target-typebox";
import { runHarness, FIXTURE_SQL } from "@supawatch/verify";

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
let dir: string;
let zodDir: string;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(FIXTURE_SQL);
  await db.exec(`
    alter table parcels enable row level security;
    create policy parcels_read on parcels for select using (true);
    create table notes (
      id serial primary key,
      user_id uuid,
      body text not null
    );
    insert into notes (body) values ('n1');
    create schema pgmq;
    create table pgmq.q_jobs (
      msg_id bigint generated always as identity primary key,
      read_ct int not null default 0,
      enqueued_at timestamptz not null default now(),
      vt timestamptz not null default now(),
      message jsonb
    );
  `);
  snapshot = await introspect(querierFromPglite(db), ["public", "pgmq"]);

  dir = await mkdtemp(path.join(HERE, "final-"));
  zodDir = path.join(dir, "zod");
  await mkdir(zodDir, { recursive: true });
  const zod = new ZodTarget();
  for (const table of snapshot.tables.filter((t) => t.schema === "public")) {
    const r = zod.renderTable(table, snapshot, {
      strict: true,
      emit: { insert: true, update: true },
    });
    await writeFile(path.join(zodDir, `${table.name}.mjs`), assemble(r));
  }
});

afterAll(async () => {
  await db.close();
  await rm(dir, { recursive: true, force: true });
});

describe("policy facet", () => {
  it("introspects rls state and policies, and diffs them", async () => {
    const parcels = snapshot.tables.find((t) => t.name === "parcels")!;
    expect(parcels.rlsEnabled).toBe(true);
    expect(parcels.policies.map((p) => p.name)).toEqual(["parcels_read"]);
    expect(parcels.policies[0].command).toBe("SELECT");

    const { diff } = await import("@supawatch/core");
    await db.exec("drop policy parcels_read on parcels");
    const next = await introspect(querierFromPglite(db), ["public", "pgmq"]);
    expect(diff(snapshot, next)).toContain("policy parcels_read dropped on public.parcels");
    await db.exec("create policy parcels_read on parcels for select using (true)");
  });
});

describe("effect target joins the parity harness as a fifth verdict", () => {
  it("five targets, full parity, empty ALLOWED ledger", async () => {
    const workDir = await mkdtemp(path.join(HERE, "effect-parity-"));
    try {
      const result = await runHarness({
        targets: [
          { target: new ZodTarget(), options: { strict: true } },
          { target: new ValibotTarget(), options: { strict: true } },
          { target: new ArktypeTarget(), options: { strict: true } },
          { target: new TypeboxTarget(), options: { strict: true } },
          { target: new EffectTarget(), options: { strict: true } },
        ],
        workDir,
      });
      expect(result.problems).toEqual([]);
      expect(result.parity.every((p) => p.agreed)).toBe(true);
      expect(Object.keys(result.parity[0].verdicts).sort()).toEqual([
        "arktype", "effect", "typebox", "valibot", "zod",
      ]);
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }, 120000);
});

describe("rest target with a real Hono app", () => {
  it("list, byId, valid and invalid create over app.request", async () => {
    const rest = new RestTarget();
    const table = snapshot.tables.find((t) => t.name === "notes")!;
    const restDir = path.join(dir, "rest");
    await mkdir(restDir, { recursive: true });
    const r = rest.renderTable(table, snapshot, { schemasImportPath: "../zod" });
    const file = path.join(restDir, "notes.mjs");
    await writeFile(file, assemble(r));
    const mod = await import(`file://${file}`);

    const query = querierFromPglite(db);
    const app = mod.createNotesRoutes({ unsafe: (t: string, p?: unknown[]) => query(t, p) });

    const list = await app.request("/");
    expect(list.status).toBe(200);
    const rows = await list.json();
    expect(rows.length).toBeGreaterThan(0);

    const one = await app.request(`/${rows[0].id}`);
    expect(one.status).toBe(200);

    const bad = await app.request("/", {
      method: "POST",
      body: JSON.stringify({ body: 123 }),
      headers: { "content-type": "application/json" },
    });
    expect(bad.status).toBe(400);

    const good = await app.request("/", {
      method: "POST",
      body: JSON.stringify({ body: "created via hono" }),
      headers: { "content-type": "application/json" },
    });
    expect(good.status).toBe(201);
    const created = await good.json();
    expect(created.body).toBe("created via hono");
  });
});

describe("service target repository", () => {
  it("list, findById, create, update, remove against real rows", async () => {
    const service = new ServiceTarget();
    const table = snapshot.tables.find((t) => t.name === "notes")!;
    const svcDir = path.join(dir, "service");
    await mkdir(svcDir, { recursive: true });
    const r = service.renderTable(table, snapshot, { schemasImportPath: "../zod" });
    const file = path.join(svcDir, "notes.mjs");
    await writeFile(file, assemble(r));
    const mod = await import(`file://${file}`);

    const query = querierFromPglite(db);
    const repo = mod.createNotesRepo({ unsafe: (t: string, p?: unknown[]) => query(t, p) });

    const created = await repo.create({ body: "via repo" });
    expect(created.body).toBe("via repo");
    const found = await repo.findById(created.id);
    expect(found.body).toBe("via repo");
    const updated = await repo.update(created.id, { body: "patched" });
    expect(updated.body).toBe("patched");
    expect(await repo.remove(created.id)).toBe(true);
    expect(await repo.findById(created.id)).toBe(null);
    await expect(repo.create({ body: 5 })).rejects.toThrow();
  });
});

describe("orpc target with real call()", () => {
  it("list, byId and validated create", async () => {
    const orpc = new OrpcTarget();
    const table = snapshot.tables.find((t) => t.name === "notes")!;
    const orpcDir = path.join(dir, "orpc");
    await mkdir(orpcDir, { recursive: true });
    const r = orpc.renderTable(table, snapshot, { schemasImportPath: "../zod" });
    const file = path.join(orpcDir, "notes.mjs");
    await writeFile(file, assemble(r));
    const mod = await import(`file://${file}`);

    const query = querierFromPglite(db);
    const router = mod.createNotesOrpc({ unsafe: (t: string, p?: unknown[]) => query(t, p) });

    const rows = await call(router.list, undefined);
    expect(rows.length).toBeGreaterThan(0);
    const one = await call(router.byId, { id: rows[0].id });
    expect(one.id).toBe(rows[0].id);
    await expect(call(router.create, { body: 42 })).rejects.toThrow();
    const created = await call(router.create, { body: "via orpc" });
    expect(created.body).toBe("via orpc");
  });
});

describe("graphql target executed for real", () => {
  it("builds a schema and answers a query from real rows", async () => {
    const target = new GraphqlTarget();
    const [file] = target.renderSnapshot(snapshot, {});
    const gqlFile = path.join(dir, "graphql-schema.mjs");
    await writeFile(gqlFile, file.content);
    // Execute in a child node process: graphql@16 has no exports map and
    // ships dual CJS/ESM builds, and vitest's resolver splits the Pothos
    // chain across the two realms. Plain node is what a real consumer
    // runs, so assert there.
    const checkFile = path.join(dir, "graphql-check.mjs");
    await writeFile(
      checkFile,
      [
        'import { PGlite } from "@electric-sql/pglite";',
        'import { graphql } from "graphql";',
        'import { createGraphqlSchema } from "./graphql-schema.mjs";',
        "const db = new PGlite();",
        'await db.exec("create table notes (id serial primary key, user_id uuid, body text not null); insert into notes (body) values (\'n1\');");',
        "const sql = { unsafe: async (t, p) => (await db.query(t, p)).rows };",
        'const result = await graphql({ schema: createGraphqlSchema(sql), source: "{ notes { id body } }" });',
        "if (result.errors) { console.error(String(result.errors[0])); process.exit(1); }",
        "console.log(JSON.stringify(result.data));",
        "await db.close();",
      ].join("\n"),
    );
    const child = spawnSync(process.execPath, [checkFile], { encoding: "utf8" });
    expect(child.stderr).toBe("");
    expect(child.status).toBe(0);
    const data = JSON.parse(child.stdout.trim()) as { notes: { id: number; body: string }[] };
    expect(data.notes.length).toBeGreaterThan(0);
    expect(typeof data.notes[0].body).toBe("string");
  });
});

describe("pgtap target", () => {
  it("emits a plan-counted structure test with rls and policy assertions", () => {
    const [file] = new PgtapTarget().renderSnapshot(snapshot, {});
    expect(file.file).toBe("structure.pgtap.sql");
    expect(file.content).toContain("select plan(");
    expect(file.content).toContain("select has_table('public', 'parcels'");
    expect(file.content).toContain("col_is_pk('public', 'parcels'");
    expect(file.content).toContain("tests.rls_enabled('public', 'parcels');");
    expect(file.content).toContain("policies_are('public', 'parcels', array['parcels_read']");
    const planned = Number(/select plan\((\d+)\);/.exec(file.content)?.[1]);
    const statements = (file.content.match(/^select (has_|col_|tests\.|policies_)/gm) ?? []).length;
    expect(planned).toBe(statements);
  });
});

describe("rls target", () => {
  it("stubs only uncovered tables, detects owner columns, honest TODO otherwise", () => {
    const [file] = new RlsTarget().renderSnapshot(snapshot, {});
    expect(file.file).toBe("rls-skeletons.sql");
    // parcels already has a policy: reported, not restubbed
    expect(file.content).toContain("parcels: rls enabled, 1 policies exist");
    expect(file.content).not.toContain('create policy "parcels_');
    // notes has user_id: owner stub plus enable rls
    expect(file.content).toContain('alter table "public"."notes" enable row level security;');
    expect(file.content).toContain('create policy "notes_select_own"');
    expect(file.content).toContain('(select auth.uid()) = "user_id"');
  });
});

describe("pgmq target", () => {
  it("detects queues from the pgmq schema and emits typed clients", () => {
    const [file] = new PgmqTarget().renderSnapshot(snapshot, {});
    expect(file.file).toBe("pgmq-clients.mjs");
    expect(file.content).toContain("export function jobsQueue(sql)");
    expect(file.content).toContain("select pgmq.send('jobs', $1::jsonb, $2::integer)");
    expect(file.content).toContain('export const queues = { "jobs": jobsQueue };');
  });

  it("emits an honest empty module when no queues exist", async () => {
    const bare = new PGlite();
    await bare.exec("create table t (id int)");
    const snap = await introspect(querierFromPglite(bare), ["public"]);
    const [file] = new PgmqTarget().renderSnapshot(snap, {});
    expect(file.content).toContain("No pgmq queues detected");
    expect(file.content).toContain("export const queues = {};");
    await bare.close();
  });
});
