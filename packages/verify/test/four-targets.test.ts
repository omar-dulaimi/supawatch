import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ZodTarget } from "@supawatch/target-zod";
import { ValibotTarget } from "@supawatch/target-valibot";
import { ArktypeTarget } from "@supawatch/target-arktype";
import { TypeboxTarget } from "@supawatch/target-typebox";
import { runHarness } from "@supawatch/verify";

const HERE = path.dirname(fileURLToPath(import.meta.url));

describe("all four targets through the harness", () => {
  it("full parity with an empty ALLOWED ledger", async () => {
    const workDir = await mkdtemp(path.join(HERE, "four-"));
    try {
      const result = await runHarness({
        targets: [
          { target: new ZodTarget(), options: { strict: true } },
          { target: new ValibotTarget(), options: { strict: true } },
          { target: new ArktypeTarget(), options: { strict: true } },
          { target: new TypeboxTarget(), options: { strict: true } },
        ],
        workDir,
      });

      expect(result.problems).toEqual([]);
      for (const g of result.groundTruth) {
        expect(g.passed, `${g.target}/${g.table}: ${g.failures[0]}`).toBe(g.rows);
      }
      expect(result.negatives.filter((n) => !n.fired)).toEqual([]);
      expect(result.parity.every((p) => p.agreed)).toBe(true);

      // Four verdicts per parity case, one per target.
      const first = result.parity[0];
      expect(Object.keys(first.verdicts).sort()).toEqual([
        "arktype",
        "typebox",
        "valibot",
        "zod",
      ]);
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }, 120000);
});
