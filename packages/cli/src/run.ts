import postgres from "postgres";
import {
  listenSource,
  manualSource,
  pollSource,
  querierFrom,
  Watcher,
  type TargetRun,
} from "@supawatch/watch";
import type { SupawatchConfig } from "./config.js";
import { entryFor, loadTarget } from "./registry.js";

export async function buildTargetRuns(cfg: SupawatchConfig): Promise<TargetRun[]> {
  const runs: TargetRun[] = [];
  for (const t of cfg.targets) {
    const entry = entryFor(t.kind);
    const target = await loadTarget(entry);
    const { kind: _kind, path: _path, ...options } = t;
    runs.push({ target, options, outDir: entry.outputDir(t, cfg) });
  }
  return runs;
}

export function connect(): postgres.Sql {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set; supawatch reads the connection from the environment only",
    );
  }
  return postgres(url, { max: 2 });
}

export async function generateOnce(cfg: SupawatchConfig): Promise<void> {
  const sql = connect();
  try {
    const watcher = new Watcher({
      query: querierFrom(sql),
      schemas: cfg.schemas,
      targets: await buildTargetRuns(cfg),
      source: manualSource(),
    });
    const result = await watcher.runOnce();
    console.log(`[supawatch] generated ${result.files.length} files`);
    let failed = 0;
    for (const v of result.verified) {
      const ok = v.passed === v.rows;
      if (!ok) failed++;
      console.log(
        `[supawatch] ground-truth check, ${v.table}: ${v.passed}/${v.rows} ${ok ? "passed" : `FAILED (${v.reasons[0] ?? ""})`}`,
      );
    }
    if (failed > 0) process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

export async function watchForever(cfg: SupawatchConfig): Promise<void> {
  const sql = connect();
  const query = querierFrom(sql);
  const debounceMs = cfg.source.kind === "listen" ? cfg.source.debounceMs : undefined;
  const source =
    cfg.source.kind === "poll"
      ? pollSource(query, {
          intervalMs: cfg.source.intervalMs,
          schemas: cfg.schemas,
        })
      : listenSource(sql, () =>
          console.log("[supawatch] idle, listening on schema_changed"),
        );
  const watcher = new Watcher({
    query,
    schemas: cfg.schemas,
    targets: await buildTargetRuns(cfg),
    source,
    debounceMs,
  });
  const shutdown = async () => {
    await watcher.stop();
    await sql.end();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  await watcher.start();
}
