import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ZodTarget } from "@supawatch/target-zod";
import { ValibotTarget } from "@supawatch/target-valibot";
import { runHarness } from "@supawatch/verify";

const HERE = path.dirname(fileURLToPath(import.meta.url));

describe("verification harness: ground truth + parity across targets", () => {
  it("zod and valibot agree on every case with an empty ALLOWED ledger", async () => {
    const workDir = await mkdtemp(path.join(HERE, "harness-"));
    try {
      const result = await runHarness({
        targets: [
          { target: new ZodTarget(), options: { strict: true } },
          { target: new ValibotTarget(), options: { strict: true } },
        ],
        workDir,
      });

      expect(result.problems).toEqual([]);

      // Ground truth: every real row accepted by every target.
      for (const g of result.groundTruth) {
        expect(g.passed, `${g.target}/${g.table}: ${g.failures[0]}`).toBe(g.rows);
      }

      // Every negative fired for every target.
      const unfired = result.negatives.filter((n) => !n.fired);
      expect(unfired).toEqual([]);

      // Full agreement, so no ALLOWED entries and none unfired.
      expect(result.parity.every((p) => p.agreed)).toBe(true);
      expect(result.unfiredAllowed).toEqual([]);

      // The pool is not trivial: wrong-kind, null-in-not-null and
      // extra-key cases all exist for both targets.
      const names = result.negatives.map((n) => n.caseName);
      expect(names.some((n) => n.includes("wrong-number"))).toBe(true);
      expect(names.some((n) => n.includes("wrong-enum"))).toBe(true);
      expect(names.some((n) => n.includes("null-in-not-null"))).toBe(true);
      expect(names.some((n) => n.includes("extra-key"))).toBe(true);
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }, 60000);

  it("a stale ALLOWED entry is reported as a problem", async () => {
    const workDir = await mkdtemp(path.join(HERE, "harness-"));
    try {
      const result = await runHarness({
        targets: [{ target: new ZodTarget(), options: { strict: true } }],
        workDir,
        allowed: [
          {
            id: "stale-entry",
            target: "zod",
            caseName: "parcels.price:wrong-string",
            reason: "excuses nothing anymore",
          },
        ],
      });
      expect(result.unfiredAllowed).toEqual(["stale-entry"]);
      expect(
        result.problems.some((p) => p.includes("stale-entry")),
      ).toBe(true);
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }, 60000);
});
