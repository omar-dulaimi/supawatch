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

  it("resolves domains to base runtime, composites to row-literal strings, views to all-nullable", async () => {
    await db.exec(`
      create type money_amount as (currency text, cents int4);
      create domain email_addr as text;
      create domain cents_amount as int4;
      create domain nested_cents as cents_amount;
      create table facets (
        id serial primary key,
        contact email_addr not null,
        fee cents_amount not null,
        deep nested_cents not null,
        split money_amount
      );
      create view facet_view as select id, contact from facets;
    `);
    const s = await introspect(querierFromPglite(db));
    const facets = s.tables.find((t) => t.name === "facets")!;
    const by = Object.fromEntries(facets.columns.map((c) => [c.name, c]));

    expect(by.contact.runtime).toEqual({ kind: "string" });
    expect(by.fee.runtime).toEqual({ kind: "number", integer: true });
    expect(by.deep.runtime).toEqual({ kind: "number", integer: true });
    expect(by.split.runtime).toEqual({ kind: "string", format: "composite" });

    expect(s.domains.map((d) => d.name).sort()).toEqual([
      "cents_amount",
      "email_addr",
      "nested_cents",
    ]);
    expect(s.domains.find((d) => d.name === "nested_cents")!.baseTypeName).toBe("int4");
    expect(s.composites.map((c) => c.name)).toEqual(["money_amount"]);

    const view = s.tables.find((t) => t.name === "facet_view")!;
    expect(view.kind).toBe("view");
    expect(view.columns.every((c) => c.nullable)).toBe(true);

    const withoutViews = await introspect(querierFromPglite(db), ["public"], {
      includeViews: false,
    });
    expect(withoutViews.tables.some((t) => t.name === "facet_view")).toBe(false);

    await db.exec(
      "drop view facet_view; drop table facets; drop domain nested_cents; drop domain cents_amount; drop domain email_addr; drop type money_amount;",
    );
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

  it("maps arrays from measured evidence: typed elements, enum arrays, unknown multidim", async () => {
    await db.exec(`
      create domain label_text as text;
      create table arr_probe (
        id serial primary key,
        tags text[] not null,
        counts int4[] not null,
        amounts numeric[] not null,
        states order_status[] not null,
        labels label_text[] not null,
        grid int4[][] not null,
        stamp bytea not null,
        shipped_on date not null
      );
    `);
    const s = await introspect(querierFromPglite(db));
    const t = s.tables.find((x) => x.name === "arr_probe")!;
    const by = Object.fromEntries(t.columns.map((c) => [c.name, c]));

    expect(by.tags.runtime).toEqual({ kind: "array", element: { kind: "string" } });
    expect(by.counts.runtime).toEqual({
      kind: "array",
      element: { kind: "number", integer: true },
    });
    expect(by.amounts.runtime).toEqual({
      kind: "array",
      element: { kind: "string", format: "numeric" },
    });
    // Measured: a fresh postgres.js connection parses enum arrays to real
    // arrays (custom type parsers are fetched at connect). PGlite still
    // returns the raw literal; the harness normalizes that under the
    // enum-array-literal-vs-array delta.
    expect(by.states.runtime).toEqual({
      kind: "array",
      element: { kind: "enum", labels: ["pending", "paid", "shipped"] },
    });
    // Domain elements resolve to their base before the array wraps them.
    expect(by.labels.runtime).toEqual({ kind: "array", element: { kind: "string" } });
    // Postgres does not enforce declared dimensionality; multidim maps honestly.
    expect(by.grid.runtime).toEqual({ kind: "array", element: { kind: "unknown" } });
    expect(by.stamp.runtime).toEqual({ kind: "bytes" });
    expect(by.shipped_on.runtime).toEqual({ kind: "date" });

    await db.exec("drop table arr_probe; drop domain label_text;");
  });

  it("supabase-js profile: measured PostgREST JSON deltas", async () => {
    await db.exec(`
      create table pr_probe (
        big int8 not null,
        price numeric(8,2) not null,
        seen_at timestamptz not null,
        shipped_on date not null,
        stamp bytea not null,
        states order_status[] not null
      );
    `);
    const s = await introspect(querierFromPglite(db), ["public"], {
      profile: "supabase-js",
    });
    const t = s.tables.find((x) => x.name === "pr_probe")!;
    const by = Object.fromEntries(t.columns.map((c) => [c.name, c]));

    expect(by.big.runtime).toEqual({ kind: "number", integer: true });
    expect(by.price.runtime).toEqual({ kind: "number", integer: false });
    expect(by.seen_at.runtime).toEqual({ kind: "string" });
    expect(by.shipped_on.runtime).toEqual({ kind: "string" });
    expect(by.stamp.runtime).toEqual({ kind: "string" });
    // PostgREST parses enum arrays into real arrays, unlike both drivers.
    expect(by.states.runtime).toEqual({
      kind: "array",
      element: { kind: "enum", labels: ["pending", "paid", "shipped"] },
    });
    await db.exec("drop table pr_probe");
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
