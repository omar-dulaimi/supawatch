import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { introspect, type Querier, type Snapshot } from "@supawatch/core";
import { SchemaCardTarget } from "@supawatch/target-schema-card";
import { DictionaryTarget } from "@supawatch/target-dictionary";
import { RealtimeTarget } from "@supawatch/target-realtime";
import { FIXTURE_SQL } from "@supawatch/verify";

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
  await db.exec(`
    comment on table parcels is 'Everything we ship.';
    comment on column parcels.tracking is 'Carrier tracking code.';
  `);
  snapshot = await introspect(querierFromPglite(db));
});

afterAll(async () => {
  await db.close();
});

describe("comments facet", () => {
  it("introspects table and column comments", () => {
    const parcels = snapshot.tables.find((t) => t.name === "parcels")!;
    expect(parcels.comment).toBe("Everything we ship.");
    const tracking = parcels.columns.find((c) => c.name === "tracking")!;
    expect(tracking.comment).toBe("Carrier tracking code.");
  });

  it("comment changes appear in the diff", async () => {
    await db.exec("comment on column parcels.tracking is 'Changed.'");
    const next = await introspect(querierFromPglite(db));
    const { diff } = await import("@supawatch/core");
    expect(diff(snapshot, next)).toContain(
      "comment on public.parcels.tracking changed",
    );
    await db.exec("comment on column parcels.tracking is 'Carrier tracking code.'");
  });
});

describe("schema-card target", () => {
  it("emits a compact card with PKs, FKs, enums, and comments", () => {
    const [file] = new SchemaCardTarget().renderSnapshot(snapshot, {});
    expect(file.file).toBe("schema-card.md");
    expect(file.content).toContain("- parcels : Everything we ship.");
    expect(file.content).toContain("id PK");
    expect(file.content).toContain("enum parcel_state: queued | shipped | lost");
    // token-lean: whole card for the fixture stays small
    expect(file.content.length).toBeLessThan(2500);
  });
});

describe("dictionary target", () => {
  it("emits per-table sections with runtime labels and comments", () => {
    const [file] = new DictionaryTarget().renderSnapshot(snapshot, {});
    expect(file.file).toBe("schema-dictionary.md");
    expect(file.content).toContain("## public.parcels");
    expect(file.content).toContain("Everything we ship.");
    expect(file.content).toContain("Carrier tracking code.");
    expect(file.content).toContain("| price | numeric(10,2) | string (numeric) | no |");
    expect(file.content).toContain("## Enums");
    expect(file.content).toContain("## Composite types");
  });
});

describe("realtime target", () => {
  it("emits wire-profile payload aliases per table, views excluded", () => {
    const [file] = new RealtimeTarget().renderSnapshot(snapshot, {});
    expect(file.file).toBe("realtime.types.ts");
    expect(file.content).toContain(
      'import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";',
    );
    expect(file.content).toContain(
      "export type ParcelsChanges = RealtimePostgresChangesPayload<ParcelsWireRow>;",
    );
    // wire profile: numeric arrives as number, timestamptz as string
    expect(file.content).toContain('"price": number;');
    expect(file.content).toContain('"seen_at": string;');
    // enum array arrives as a REAL array on the wire
    expect(file.content).toContain('"states": ("queued" | "shipped" | "lost")[];');
    // the fixture view is not a changes source
    expect(file.content).not.toContain("Lost_parcelsChanges");
  });
});
