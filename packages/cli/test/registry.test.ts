import { describe, expect, it } from "vitest";
import { ConfigSchema, TARGET_KINDS, TARGETS, entryFor } from "supawatch";

describe("registry stays in lockstep with config", () => {
  it("registry kinds equal the config enum kinds", () => {
    expect(TARGETS.map((t) => t.kind).sort()).toEqual([...TARGET_KINDS].sort());
  });

  it("every entry's default dir derives from outDir once, in the registry", () => {
    const cfg = ConfigSchema.parse({ targets: [{ kind: "zod" }] });
    const entry = entryFor("zod");
    expect(entry.outputDir(cfg.targets[0], cfg)).toBe("src/schemas/zod");
    expect(
      entry.outputDir({ kind: "zod", path: "elsewhere" }, cfg),
    ).toBe("elsewhere");
  });

  it("config rejects unknown target kinds by name", () => {
    const parsed = ConfigSchema.safeParse({ targets: [{ kind: "yup" }] });
    expect(parsed.success).toBe(false);
  });

  it("config defaults are what init scaffolds", () => {
    const cfg = ConfigSchema.parse({ targets: [{ kind: "zod" }] });
    expect(cfg.schemas).toEqual(["public"]);
    expect(cfg.outDir).toBe("src/schemas");
    expect(cfg.source).toEqual({ kind: "listen" });
  });
});
