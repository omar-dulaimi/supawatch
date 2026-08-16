import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import {
  assemble,
  atomicSink,
  introspect,
  type Querier,
  type Snapshot,
  type Table,
  type Target,
  type TargetOptions,
} from "@supawatch/core";
import { FIXTURE_SQL, assertFixtureCompleteness } from "./fixture.js";

export interface HarnessTarget {
  target: Target;
  options: TargetOptions;
}

// A named, deliberate divergence. Every entry must fire during the run;
// an entry that stops firing fails the harness so a fixed gap reports
// itself instead of rotting in the ledger.
export interface AllowedDivergence {
  id: string;
  target: string;
  caseName: string;
  reason: string;
}

export interface ParityCase {
  table: string;
  caseName: string;
  verdicts: Record<string, boolean>;
  agreed: boolean;
  allowedId?: string;
}

export interface GroundTruthRow {
  target: string;
  table: string;
  rows: number;
  passed: number;
  failures: string[];
}

export interface NegativeResult {
  target: string;
  caseName: string;
  fired: boolean;
}

export interface HarnessResult {
  groundTruth: GroundTruthRow[];
  negatives: NegativeResult[];
  parity: ParityCase[];
  unfiredAllowed: string[];
  problems: string[];
}

// Where PGlite's client and postgres.js disagree about a type's JS value,
// the harness normalizes to the postgres.js profile, because that is what
// consumers run. Each delta is named here; a new one must be added
// consciously, not absorbed silently.
export const DRIVER_DELTAS = [
  {
    id: "int8-bigint-vs-string",
    detail:
      "PGlite parses int8 to a JS BigInt; postgres.js returns its decimal string. Normalized: BigInt -> String(value).",
  },
  {
    id: "enum-array-literal-vs-array",
    detail:
      "PGlite returns enum arrays as the raw pg literal; a fresh postgres.js connection parses them to real arrays (measured; parsers are fetched at connect). Normalized: literal -> parsed array on enum-array columns.",
  },
] as const;

// Minimal pg array-literal parser for the enum-array delta: handles
// quoted elements, doubled quotes, and backslash escapes.
export function parsePgTextArray(literal: string): string[] {
  const inner = literal.slice(1, -1);
  if (inner === "") return [];
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  let wasQuoted = false;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (quoted) {
      if (ch === "\\") {
        cur += inner[++i];
      } else if (ch === '"') {
        if (inner[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
      wasQuoted = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
      wasQuoted = false;
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  void wasQuoted;
  return out;
}

function normalize(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  return value;
}

function querierFromPglite(db: PGlite): Querier {
  return async <T = Record<string, unknown>>(text: string, params?: unknown[]) => {
    const result = await db.query<Record<string, unknown>>(text, params as unknown[]);
    return result.rows.map((row) => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) out[k] = normalize(v);
      return out;
    }) as T[];
  };
}

// Build per-column wrong values from the runtime kind. Each one is a value
// the driver can never produce for that column, so every target must
// reject it. json and unknown accept anything and produce no negatives;
// so does an array of unknown, which is the honest multidim mapping.
function negativeValueFor(table: Table, colName: string): unknown | undefined {
  const col = table.columns.find((c) => c.name === colName)!;
  return wrongValueFor(col.runtime);
}

function wrongValueFor(runtime: Table["columns"][number]["runtime"]): unknown | undefined {
  switch (runtime.kind) {
    case "number":
      return "42";
    case "string":
      return 42;
    case "boolean":
      return "true";
    case "date":
      return "2026-01-01T00:00:00Z";
    case "bytes":
      return "deadbeef";
    case "enum":
      return "not_a_label";
    case "array": {
      // Two failure modes: not an array at all, or a wrong element.
      // The scalar case here is the not-an-array one; the element-level
      // negative is added separately below.
      return "not-an-array";
    }
    case "json":
    case "unknown":
      return undefined;
  }
}

function wrongElementFor(
  runtime: Table["columns"][number]["runtime"],
): unknown | undefined {
  if (runtime.kind !== "array") return undefined;
  const el = wrongValueFor(runtime.element);
  if (el === undefined) return undefined;
  return [el];
}

export async function runHarness(opts: {
  targets: HarnessTarget[];
  workDir: string;
  allowed?: AllowedDivergence[];
}): Promise<HarnessResult> {
  const allowed = opts.allowed ?? [];
  const db = new PGlite();
  const problems: string[] = [];
  try {
    await db.exec(FIXTURE_SQL);
    const query = querierFromPglite(db);
    const snapshot: Snapshot = await introspect(query);
    assertFixtureCompleteness(snapshot);

    // Emit every target's schemas once, into workDir/<target>/.
    const loaded = new Map<
      string,
      {
        schemaByTable: Map<string, unknown>;
        verifier: import("@supawatch/core").Verifier;
      }
    >();
    for (const { target, options } of opts.targets) {
      if (!target.verifier) {
        throw new Error(
          `harness target ${target.name} has no verifier; type-only targets do not belong in the harness`,
        );
      }
      const dir = path.join(opts.workDir, target.name);
      const verifier = target.verifier();
      const schemaByTable = new Map<string, unknown>();
      for (const table of snapshot.tables) {
        const rendered = target.renderTable(table, snapshot, options);
        const file = path.join(dir, `${table.name}${target.fileExtension}`);
        await atomicSink.write(file, assemble(rendered));
        schemaByTable.set(table.name, await verifier.load(file, rendered.exportName));
      }
      loaded.set(target.name, { schemaByTable, verifier });
    }

    // Case pool: real rows (positive) plus synthetic negatives.
    const groundTruth: GroundTruthRow[] = [];
    const negatives: NegativeResult[] = [];
    const parity: ParityCase[] = [];

    for (const table of snapshot.tables) {
      const rows = await query(
        `select * from "${table.name}" limit 10`,
      );

      // The enum-array-literal-vs-array delta: PGlite hands back the raw
      // literal, generated schemas expect the parsed array that a fresh
      // postgres.js connection returns.
      for (const col of table.columns) {
        if (col.runtime.kind !== "array" || col.runtime.element.kind !== "enum") continue;
        for (const row of rows) {
          const v = (row as Record<string, unknown>)[col.name];
          if (typeof v === "string") {
            (row as Record<string, unknown>)[col.name] = parsePgTextArray(v);
          }
        }
      }

      // Ground truth: every real row must be accepted by every target.
      for (const [name, { schemaByTable, verifier }] of loaded) {
        const schema = schemaByTable.get(table.name)!;
        let passed = 0;
        const failures: string[] = [];
        for (const row of rows) {
          const verdict = verifier.check(schema, row);
          if (verdict.ok) passed++;
          else failures.push(`${table.name}: ${verdict.reason ?? "no reason"}`);
        }
        groundTruth.push({
          target: name,
          table: table.name,
          rows: rows.length,
          passed,
          failures,
        });
        if (passed !== rows.length) {
          problems.push(
            `ground truth: ${name} rejected a real ${table.name} row (${failures[0]})`,
          );
        }
      }

      if (rows.length === 0) continue;
      const base = rows[0] as Record<string, unknown>;

      // Negatives and parity, one case per column plus one extra-key case.
      const cases: { caseName: string; value: Record<string, unknown>; expectReject: boolean }[] = [];
      for (const col of table.columns) {
        const wrong = negativeValueFor(table, col.name);
        if (wrong === undefined) continue;
        cases.push({
          caseName: `${table.name}.${col.name}:wrong-${col.runtime.kind}`,
          value: { ...base, [col.name]: wrong },
          expectReject: true,
        });
        const wrongElement = wrongElementFor(col.runtime);
        if (wrongElement !== undefined) {
          cases.push({
            caseName: `${table.name}.${col.name}:wrong-element`,
            value: { ...base, [col.name]: wrongElement },
            expectReject: true,
          });
        }
        if (!col.nullable && col.runtime.kind !== "unknown" && col.runtime.kind !== "json") {
          cases.push({
            caseName: `${table.name}.${col.name}:null-in-not-null`,
            value: { ...base, [col.name]: null },
            expectReject: true,
          });
        }
      }
      cases.push({
        caseName: `${table.name}:extra-key`,
        value: { ...base, __supawatch_extra: 1 },
        expectReject: true,
      });

      for (const c of cases) {
        const verdicts: Record<string, boolean> = {};
        for (const [name, { schemaByTable, verifier }] of loaded) {
          const schema = schemaByTable.get(table.name)!;
          const verdict = verifier.check(schema, c.value);
          verdicts[name] = verdict.ok;
          if (c.expectReject) {
            const fired = !verdict.ok;
            negatives.push({ target: name, caseName: c.caseName, fired });
            if (!fired) {
              const entry = allowed.find(
                (a) => a.target === name && a.caseName === c.caseName,
              );
              if (!entry) {
                problems.push(
                  `negative did not fire: ${name} accepted ${c.caseName}`,
                );
              }
            }
          }
        }
        const values = Object.values(verdicts);
        const agreed = values.every((x) => x === values[0]);
        let allowedId: string | undefined;
        if (!agreed) {
          const entry = allowed.find((a) => a.caseName === c.caseName);
          allowedId = entry?.id;
          if (!entry) {
            problems.push(
              `parity: targets disagree on ${c.caseName} (${JSON.stringify(verdicts)}) with no ALLOWED entry`,
            );
          }
        }
        parity.push({ table: table.name, caseName: c.caseName, verdicts, agreed, allowedId });
      }
    }

    // Ledger hygiene: every ALLOWED entry must have fired.
    const firedIds = new Set(parity.filter((p) => p.allowedId).map((p) => p.allowedId));
    for (const n of negatives) {
      if (!n.fired) {
        const entry = allowed.find((a) => a.target === n.target && a.caseName === n.caseName);
        if (entry) firedIds.add(entry.id);
      }
    }
    const unfiredAllowed = allowed
      .filter((a) => !firedIds.has(a.id))
      .map((a) => a.id);
    for (const id of unfiredAllowed) {
      problems.push(
        `ALLOWED entry ${id} never fired; the divergence it excuses is gone, remove it`,
      );
    }

    return { groundTruth, negatives, parity, unfiredAllowed, problems };
  } finally {
    await db.close();
  }
}
