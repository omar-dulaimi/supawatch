import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Emitted files must resolve "zod" the way a consumer's project would, so
// the temp dir lives inside this package rather than in /tmp.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const tmpdir = () => HERE;
import { describe, expect, it } from "vitest";
import { assemble, type Snapshot, type Table } from "@supawatch/core";
import { ZodTarget } from "@supawatch/target-zod";

const ordersTable: Table = {
  schema: "public",
  name: "orders",
  columns: [
    {
      name: "id",
      sqlType: "integer",
      pgTypeName: "int4",
      runtime: { kind: "number", integer: true },
      nullable: false,
      hasDefault: true,
    },
    {
      name: "status",
      sqlType: "order_status",
      pgTypeName: "order_status",
      runtime: { kind: "enum", labels: ["pending", "paid"] },
      nullable: false,
      hasDefault: true,
      enumRef: "order_status",
    },
    {
      name: "total",
      sqlType: "numeric(10,2)",
      pgTypeName: "numeric",
      runtime: { kind: "string", format: "numeric" },
      nullable: false,
      hasDefault: false,
    },
    {
      name: "placed_at",
      sqlType: "timestamptz",
      pgTypeName: "timestamptz",
      runtime: { kind: "date" },
      nullable: false,
      hasDefault: true,
    },
    {
      name: "note",
      sqlType: "text",
      pgTypeName: "text",
      runtime: { kind: "string" },
      nullable: true,
      hasDefault: false,
    },
  ],
};

const snapshot: Snapshot = {
  tables: [ordersTable],
  enums: [{ schema: "public", name: "order_status", labels: ["pending", "paid"] }],
};

describe("ZodTarget.renderTable", () => {
  it("renders driver truth: numeric is a string, timestamptz a Date", () => {
    const target = new ZodTarget();
    const rendered = target.renderTable(ordersTable, snapshot, { strict: true });
    expect(rendered.exportName).toBe("ordersRow");
    expect(rendered.imports).toEqual([{ from: "zod", names: ["z"] }]);
    expect(rendered.body).toContain('"total": z.string()');
    expect(rendered.body).toContain('"placed_at": z.date()');
    expect(rendered.body).toContain('"status": z.enum(["pending", "paid"])');
    expect(rendered.body).toContain('"note": z.string().nullable()');
    expect(rendered.body).toContain("z.strictObject({");
  });

  it("honors strict: false", () => {
    const target = new ZodTarget();
    const rendered = target.renderTable(ordersTable, snapshot, { strict: false });
    expect(rendered.body).toContain("z.object({");
    expect(rendered.body).not.toContain("z.strictObject({");
  });

  it("renders a typed companion declaration", () => {
    const target = new ZodTarget();
    const types = target.renderTypes!(ordersTable, snapshot, {});
    expect(types).toContain('"status": "pending" | "paid";');
    expect(types).toContain('"total": string;');
    expect(types).toContain('"note": string | null;');
    expect(types).toContain("export declare const ordersRow: z.ZodType<ordersRowType>;");
  });
});

describe("ZodTarget.verifier against the emitted artifact", () => {
  it("accepts a driver-truth row and rejects a naive one (must-fire)", async () => {
    const target = new ZodTarget();
    const rendered = target.renderTable(ordersTable, snapshot, { strict: true });
    const dir = await mkdtemp(path.join(tmpdir(), "supawatch-"));
    try {
      const file = path.join(dir, "orders.mjs");
      await writeFile(file, assemble(rendered));

      const verifier = target.verifier();
      const schema = await verifier.load(file, rendered.exportName);

      const goodRow = {
        id: 1,
        status: "paid",
        total: "49.90",
        placed_at: new Date(),
        note: null,
      };
      expect(verifier.check(schema, goodRow)).toEqual({ ok: true });

      // The negative control: numeric as a JS number must be rejected,
      // because the driver returns a string. If this passes, the whole
      // ground-truth story is a rubber stamp.
      const naiveRow = { ...goodRow, total: 49.9 };
      const verdict = verifier.check(schema, naiveRow);
      expect(verdict.ok).toBe(false);
      expect(verdict.reason).toBeTruthy();

      // strictObject: an extra column the schema does not know about fails.
      const extraRow = { ...goodRow, surprise: 1 };
      expect(verifier.check(schema, extraRow).ok).toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("names the missing export instead of crashing opaquely", async () => {
    const target = new ZodTarget();
    const dir = await mkdtemp(path.join(tmpdir(), "supawatch-"));
    try {
      const file = path.join(dir, "empty.mjs");
      await writeFile(file, "export const nothing = 1;\n");
      await expect(target.verifier().load(file, "ordersRow")).rejects.toThrow(
        /no export ordersRow/,
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
