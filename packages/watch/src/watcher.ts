import path from "node:path";
import {
  assemble,
  atomicSink,
  diff,
  introspect,
  type FileSink,
  type Querier,
  type Snapshot,
  type Target,
  type TargetOptions,
} from "@supawatch/core";
import type { TriggerSource } from "./sources.js";

export interface TargetRun {
  target: Target;
  options: TargetOptions;
  outDir: string;
}

export interface WatcherOptions {
  query: Querier;
  schemas?: string[];
  includeViews?: boolean;
  profile?: import("@supawatch/core").DriverProfile;
  targets: TargetRun[];
  source: TriggerSource;
  sink?: FileSink;
  debounceMs?: number;
  verifyRows?: boolean;
  barrel?: boolean;
  log?: (msg: string) => void;
}

export interface CycleResult {
  changes: string[];
  files: string[];
  verified: { table: string; rows: number; passed: number; reasons: string[] }[];
}

export class Watcher {
  private last: Snapshot | undefined;
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private rerun = false;
  private readonly sink: FileSink;
  private readonly log: (msg: string) => void;
  private readonly debounceMs: number;

  constructor(private readonly opts: WatcherOptions) {
    this.sink = opts.sink ?? atomicSink;
    this.log = opts.log ?? ((m) => console.log(`[supawatch] ${m}`));
    this.debounceMs = opts.debounceMs ?? 300;
  }

  async start(): Promise<void> {
    const baseline = await this.cycle(true);
    this.log(
      `baseline: ${this.last!.tables.length} tables, ${this.last!.enums.length} enums, ${baseline.files.length} files`,
    );
    this.reportVerified(baseline);
    await this.opts.source.start((hint) => this.onWake(hint));
  }

  async stop(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    await this.opts.source.stop();
  }

  // Exposed for the manual source and tests: run one cycle immediately.
  async runOnce(): Promise<CycleResult> {
    const result = await this.cycle(this.last === undefined);
    return result;
  }

  private onWake(hint: string) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.wakeCycle(hint);
    }, this.debounceMs);
  }

  private async wakeCycle(hint: string) {
    if (this.running) {
      this.rerun = true;
      return;
    }
    this.running = true;
    try {
      const result = await this.cycle(false);
      if (result.changes.length === 0) {
        this.log(`woke on ${hint}, no structural change`);
        return;
      }
      for (const c of result.changes) this.log(c);
      this.log(`regenerated ... ${result.files.length} files`);
      this.reportVerified(result);
    } finally {
      this.running = false;
      if (this.rerun) {
        this.rerun = false;
        void this.wakeCycle("queued notify");
      }
    }
  }

  private async cycle(isBaseline: boolean): Promise<CycleResult> {
    const next = await introspect(this.opts.query, this.opts.schemas, {
      includeViews: this.opts.includeViews,
      profile: this.opts.profile,
    });
    const changes = this.last ? diff(this.last, next) : [];
    if (!isBaseline && changes.length === 0) {
      return { changes, files: [], verified: [] };
    }

    const files: string[] = [];
    const verified: CycleResult["verified"] = [];

    // Prunes are aggregated per directory and extension across ALL
    // targets, then executed once. Per-target pruning deleted sibling
    // targets' files when several shared an outDir, which the e2e
    // caught when schema-card's .md prune ate the ERD.
    const pruneJobs = new Map<string, Set<string>>();
    const notePrune = (dir: string, extension: string, keep: Iterable<string>) => {
      const key = `${dir}\u0000${extension}`;
      const set = pruneJobs.get(key) ?? new Set<string>();
      for (const k of keep) set.add(k);
      pruneJobs.set(key, set);
    };

    // With one schema, files keep bare table names. With several, every
    // file is prefixed with its schema, because two schemas can hold
    // same-named tables and the last write would silently win otherwise.
    const multiSchema = new Set(next.tables.map((t) => t.schema)).size > 1;
    const fileBase = (t: { schema: string; name: string }) =>
      multiSchema ? `${t.schema}.${t.name}` : t.name;

    for (const run of this.opts.targets) {
      // Snapshot-level targets (the Database bridge) emit whole files;
      // no per-table schemas, no barrel, no row verification.
      if (run.target.renderSnapshot) {
        const emitted = run.target.renderSnapshot(next, run.options);
        const keepSnap = new Set<string>();
        for (const f of emitted) {
          const file = path.join(run.outDir, f.file);
          await this.sink.write(file, f.content);
          keepSnap.add(f.file);
          files.push(file);
        }
        notePrune(run.outDir, run.target.fileExtension, keepSnap);
        continue;
      }
      const keep = new Set<string>();
      for (const table of next.tables) {
        const rendered = run.target.renderTable(table, next, run.options);
        const base = `${fileBase(table)}${run.target.fileExtension}`;
        const file = path.join(run.outDir, base);
        const content = run.target.assembleFile
          ? run.target.assembleFile(rendered)
          : assemble(rendered);
        await this.sink.write(file, content);
        keep.add(base);
        files.push(file);

        if (run.target.renderTypes) {
          const typesFile = path.join(run.outDir, `${fileBase(table)}.d.mts`);
          await this.sink.write(
            typesFile,
            run.target.renderTypes(table, next, run.options),
          );
        }

        // Row verification measures the postgres-js profile; rows
        // fetched here come from postgres.js, so schemas generated for
        // the PostgREST JSON profile would rightly reject them. The e2e
        // verifies that profile against real PostgREST responses.
        if (
          this.opts.verifyRows !== false &&
          (this.opts.profile ?? "postgres-js") === "postgres-js" &&
          run.target.verifier
        ) {
          const v = await this.verifyTable(run, table, file, rendered.exportName);
          verified.push(v);
        }
      }
      // One barrel per target dir. The runtime barrel alone is NOT
      // enough: TypeScript refuses to type an import of index.mjs
      // without an adjacent index.d.mts (found by dogfooding under
      // strict TS), so the declaration barrel ships beside it and
      // re-exports the same entries, which TS resolves to their .d.mts.
      const keepTypes = new Set(next.tables.map((t) => `${fileBase(t)}.d.mts`));
      if (this.opts.barrel !== false && run.target.barrel !== false) {
        const lines = next.tables
          .map((t) => `export * from "./${fileBase(t)}${run.target.fileExtension}";`)
          .sort()
          .join("\n");
        const header = "// Generated by supawatch. Do not edit.";
        const indexFile = path.join(run.outDir, `index${run.target.fileExtension}`);
        await this.sink.write(indexFile, `${header}\n${lines}\n`);
        keep.add(`index${run.target.fileExtension}`);
        files.push(indexFile);
        if (run.target.renderTypes) {
          const indexTypes = path.join(run.outDir, "index.d.mts");
          await this.sink.write(indexTypes, `${header}\n${lines}\n`);
          keepTypes.add("index.d.mts");
          files.push(indexTypes);
        }
      }
      notePrune(run.outDir, run.target.fileExtension, keep);
      notePrune(run.outDir, ".d.mts", keepTypes);
    }

    for (const [key, keep] of pruneJobs) {
      const [dir, extension] = key.split("\u0000");
      await this.sink.prune(dir, keep, extension);
    }

    this.last = next;
    return { changes, files, verified };
  }

  private async verifyTable(
    run: TargetRun,
    table: { schema: string; name: string },
    file: string,
    exportName: string,
  ) {
    const verifier = run.target.verifier!();
    const schema = await verifier.load(file, exportName);
    const ident = `"${table.schema.replace(/"/g, '""')}"."${table.name.replace(/"/g, '""')}"`;
    const rows = await this.opts.query(`select * from ${ident} limit 10`);
    let passed = 0;
    const reasons: string[] = [];
    for (const row of rows) {
      const verdict = verifier.check(schema, row);
      if (verdict.ok) passed++;
      else if (verdict.reason) reasons.push(verdict.reason);
    }
    return { table: table.name, rows: rows.length, passed, reasons };
  }

  private reportVerified(result: CycleResult) {
    for (const v of result.verified) {
      if (v.passed === v.rows) {
        this.log(`ground-truth check, ${v.table}: ${v.passed}/${v.rows} passed`);
      } else {
        this.log(
          `ground-truth check, ${v.table}: ${v.passed}/${v.rows} FAILED (${v.reasons[0] ?? "no reason"})`,
        );
      }
    }
  }
}
