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
import { fileBaseName } from "@supawatch/core";
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
    // Single source of truth with the emitters' own import paths.
    const fileBase = (t: { schema: string; name: string }) =>
      fileBaseName(t, next);

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
      // A schema named "a.b" holding table "c" and a schema "a" holding
      // table "b.c" both land on the file a.b.c: last write wins
      // silently. Refuse file-name collisions like export-name ones.
      const fileOwners = new Map<string, string>();
      for (const t of next.tables) {
        // ESM import specifiers resolve as URLs, and the URL parser
        // strips \n, \r and \t: a relation whose file name contains one
        // can be written but never imported again.
        if (/[\n\r\t]/.test(t.name) || /[\n\r\t]/.test(t.schema)) {
          throw new Error(
            `relation ${JSON.stringify(t.schema)}.${JSON.stringify(t.name)} contains a control character ` +
              `(newline, carriage return, or tab); its generated module could never be imported. Rename it.`,
          );
        }
        const fb = fileBase(t);
        const owner = fileOwners.get(fb);
        // dot-joined identity is itself ambiguous for these names
        const tk = JSON.stringify([t.schema, t.name]);
        if (owner !== undefined && owner !== tk) {
          throw new Error(
            `${owner} and ${tk} both emit the file "${fb}${run.target.fileExtension}"; ` +
              `rename one relation or generate the schemas into separate outDirs.`,
          );
        }
        fileOwners.set(fb, tk);
      }
      // Sanitized export names can collide ("a b" and "a-b" both become
      // a_b; two schemas can hold same-named tables). Colliding names in
      // one barrel are ambiguous star exports, which ESM silently DROPS,
      // so both schemas would vanish without an error. Fail loudly
      // instead.
      const exportOwners = new Map<string, string>();
      for (const table of next.tables) {
        // A column literally named __proto__ cannot be carried by a
        // JavaScript object literal: even as a quoted string key it sets
        // the object's prototype instead of a property, silently
        // corrupting every generated schema for the table. Refuse.
        if (table.columns.some((c) => c.name === "__proto__")) {
          throw new Error(
            `table ${table.schema}.${table.name} has a column named "__proto__"; ` +
              `JavaScript object literals cannot represent that name safely, so generated ` +
              `schemas would be silently corrupted. Rename the column.`,
          );
        }
        // A NOT NULL column of a zero-label enum can never hold any
        // value; every generated artifact for it would be unsatisfiable.
        const emptyRequired = table.columns.find(
          (c) =>
            c.runtime.kind === "enum" &&
            c.runtime.labels.length === 0 &&
            !c.nullable &&
            !c.hasDefault,
        );
        if (emptyRequired) {
          throw new Error(
            `table ${table.schema}.${table.name} column ${emptyRequired.name} uses an enum with zero labels and is NOT NULL; ` +
              `no value can ever satisfy it. Add labels to the enum or make the column nullable.`,
          );
        }
        const rendered = run.target.renderTable(table, next, run.options);
        const tableKey = JSON.stringify([table.schema, table.name]);
        const owner = exportOwners.get(rendered.exportName);
        if (owner !== undefined && owner !== tableKey) {
          throw new Error(
            `target ${run.target.name}: ${owner} and ${tableKey} both emit the export "${rendered.exportName}"; ` +
              `an ESM barrel silently drops ambiguous names, so this cannot be generated. ` +
              `Rename one relation, or generate the schemas into separate outDirs via per-target "path".`,
          );
        }
        exportOwners.set(rendered.exportName, tableKey);
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
        // A table named "index" writes index.mjs, the barrel's own file;
        // the barrel would silently replace the table's schema. Refuse.
        const clash = next.tables.find(
          (t) => fileBase(t) === "index",
        );
        if (clash) {
          throw new Error(
            `table ${clash.schema}.${clash.name} emits index${run.target.fileExtension}, which is the barrel's own file name; ` +
              `rename the table, set barrel: false, or give the target its own path.`,
          );
        }
        const lines = next.tables
          .map(
            (t) =>
              `export * from ${JSON.stringify(`./${fileBase(t)}${run.target.fileExtension}`)};`,
          )
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
    table: { schema: string; name: string; kind?: string },
    file: string,
    exportName: string,
  ) {
    const verifier = run.target.verifier!();
    const schema = await verifier.load(file, exportName);
    const ident = `"${table.schema.replace(/"/g, '""')}"."${table.name.replace(/"/g, '""')}"`;
    let rows: Record<string, unknown>[];
    try {
      rows = await this.opts.query(`select * from ${ident} limit 10`);
    } catch (err) {
      // An unpopulated materialized view (created WITH NO DATA, not yet
      // refreshed) errors on any read. That is a deploy-order fact, not
      // a schema-truth failure; verify nothing rather than abort the
      // whole run.
      if (String(err).includes("has not been populated")) {
        this.log(`ground-truth check, ${table.name}: skipped (materialized view not populated)`);
        return { table: table.name, rows: 0, passed: 0, reasons: [] };
      }
      // A foreign table reads from somewhere else entirely; a dead FDW
      // server or malformed source file is that source's problem, not a
      // schema-truth failure.
      if (table.kind === "foreign") {
        this.log(`ground-truth check, ${table.name}: skipped (foreign table read failed)`);
        return { table: table.name, rows: 0, passed: 0, reasons: [] };
      }
      throw err;
    }
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
