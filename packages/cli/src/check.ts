import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { FileSink } from "@supawatch/core";
import { manualSource, querierFrom, Watcher } from "@supawatch/watch";
import type { SupawatchConfig } from "./config.js";
import { buildTargetRuns, connect } from "./run.js";

// A sink that never touches disk: check regenerates into memory and diffs
// against what is committed. Drift means someone changed the database and
// did not regenerate, or edited generated files by hand.
class CollectSink implements FileSink {
  readonly files = new Map<string, string>();
  readonly prunedDirs = new Map<string, { keep: Set<string>; extension: string }[]>();

  async write(file: string, content: string): Promise<void> {
    this.files.set(file, content);
  }
  async prune(dir: string, keep: Set<string>, extension: string): Promise<string[]> {
    const list = this.prunedDirs.get(dir) ?? [];
    list.push({ keep, extension });
    this.prunedDirs.set(dir, list);
    return [];
  }
}

export interface Drift {
  file: string;
  kind: "missing" | "stale" | "orphaned" | "format";
}

export async function check(cfg: SupawatchConfig): Promise<Drift[]> {
  const sql = connect();
  try {
    const sink = new CollectSink();
    const watcher = new Watcher({
      query: querierFrom(sql),
      schemas: cfg.schemas,
      includeViews: cfg.includeViews,
      barrel: cfg.barrel,
      profile: cfg.profile,
      targets: await buildTargetRuns(cfg),
      source: manualSource(),
      sink,
      verifyRows: false,
      log: () => {},
    });
    await watcher.runOnce();

    const drift: Drift[] = [];
    for (const [file, expected] of sink.files) {
      let actual: string;
      try {
        actual = await readFile(file, "utf8");
      } catch {
        drift.push({ file, kind: "missing" });
        continue;
      }
      if (actual !== expected) {
        // A lockfile written by an older supawatch differs because the
        // recorded SHAPE changed, not because the schema did. Saying
        // "stale" sends a team hunting a schema change that never
        // happened, so name the real cause.
        drift.push({ file, kind: lockFormatChanged(actual, expected) ? "format" : "stale" });
      }
    }
    // Files on disk that regeneration would prune are drift too.
    for (const [dir, prunes] of sink.prunedDirs) {
      let entries: string[];
      try {
        entries = await readdir(dir);
      } catch {
        continue;
      }
      for (const { keep, extension } of prunes) {
        for (const entry of entries) {
          if (entry.endsWith(extension) && !keep.has(entry)) {
            drift.push({ file: path.join(dir, entry), kind: "orphaned" });
          }
        }
      }
    }
    return drift;
  } finally {
    await sql.end();
  }
}

// Both sides are the committed and the freshly generated lockfile; a
// differing `format` means this supawatch records a different shape.
function lockFormatChanged(actual: string, expected: string): boolean {
  if (!actual.includes('"format"')) return false;
  try {
    const a = JSON.parse(actual) as { format?: unknown };
    const b = JSON.parse(expected) as { format?: unknown };
    return a.format !== b.format;
  } catch {
    return false;
  }
}
