import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { diff, introspect, type Snapshot } from "@supawatch/core";
import { FIXTURE_SQL, querierFromPglite } from "./pglite.js";

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

describe("introspect against a real Postgres (PGlite)", () => {
  it("finds both tables and the enum", () => {
    expect(snapshot.tables.map((t) => t.name).sort()).toEqual(["orders", "users"]);
    expect(snapshot.enums).toEqual([
      { schema: "public", name: "order_status", labels: ["pending", "paid", "shipped"] },
    ]);
  });

  it("maps runtime types from driver truth, not SQL names", () => {
    const orders = snapshot.tables.find((t) => t.name === "orders")!;
    const byName = Object.fromEntries(orders.columns.map((c) => [c.name, c]));

    expect(byName.id.runtime).toEqual({ kind: "number", integer: true });
    expect(byName.status.runtime).toEqual({
      kind: "enum",
      labels: ["pending", "paid", "shipped"],
    });
    expect(byName.total.runtime).toEqual({ kind: "string", format: "numeric" });
    expect(byName.big_ref.runtime).toEqual({ kind: "string", format: "bigint" });
    expect(byName.metadata.runtime).toEqual({ kind: "json" });
    expect(byName.placed_at.runtime).toEqual({ kind: "date" });
  });

  it("captures nullability and defaults", () => {
    const users = snapshot.tables.find((t) => t.name === "users")!;
    const byName = Object.fromEntries(users.columns.map((c) => [c.name, c]));
    expect(byName.display_name.nullable).toBe(true);
    expect(byName.email.nullable).toBe(false);
    expect(byName.is_admin.hasDefault).toBe(true);
    expect(byName.ref.runtime).toEqual({ kind: "string", format: "uuid" });
  });

  it("falls back to unknown for unmapped types instead of guessing", async () => {
    await db.exec("create table exotic (rng int4range)");
    const next = await introspect(querierFromPglite(db));
    const exotic = next.tables.find((t) => t.name === "exotic")!;
    expect(exotic.columns[0].runtime).toEqual({ kind: "unknown" });
    await db.exec("drop table exotic");
  });
});

describe("diff", () => {
  it("describes an added column with type and nullability", async () => {
    await db.exec("alter table orders add column refund_reason text");
    const next = await introspect(querierFromPglite(db));
    expect(diff(snapshot, next)).toEqual([
      "public.orders gained refund_reason (text, nullable)",
    ]);
    await db.exec("alter table orders drop column refund_reason");
  });

  it("describes enum growth and new tables", async () => {
    await db.exec("alter type order_status add value 'cancelled'");
    await db.exec("create table refunds (id serial primary key)");
    const next = await introspect(querierFromPglite(db));
    const changes = diff(snapshot, next);
    expect(changes).toContain("table public.refunds created");
    expect(changes).toContain("enum public.order_status gained 'cancelled'");
    await db.exec("drop table refunds");
  });

  it("reports nothing when nothing changed", async () => {
    const again = await introspect(querierFromPglite(db));
    const base = await introspect(querierFromPglite(db));
    expect(diff(base, again)).toEqual([]);
  });
});
