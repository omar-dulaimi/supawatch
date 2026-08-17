import { readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import {
  listenSource,
  manualSource,
  pollSource,
  describeVerified,
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
    runs.push({
      target,
      options: { ...options, jsonTypes: cfg.jsonTypes },
      outDir: entry.outputDir(t, cfg),
    });
  }
  return runs;
}

// The driver decodes values by TEXT, so three server settings decide
// whether what it hands back is the truth. Measured against Postgres 17:
// with bytea_output=escape an 8 byte value came back as 1 wrong byte,
// and with DateStyle=German the date 2026-03-04 came back as
// 2026-04-02, both silently. A database or role can force either for
// every connection (alter database ... set), so supawatch pins them on
// its own connections rather than trusting the environment. doctor
// warns when the environment would corrupt a consumer's connection.
export const DRIVER_TRUTH_SETTINGS = {
  DateStyle: "ISO, MDY",
  bytea_output: "hex",
  IntervalStyle: "postgres",
} as const;

export function connect(): postgres.Sql {
  const url = process.env.DATABASE_URL ?? readDotEnvDatabaseUrl();
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set; export it or put DATABASE_URL=... in ./.env",
    );
  }
  return postgres(url, { max: 2, connection: { ...DRIVER_TRUTH_SETTINGS } });
}

// Real projects keep DATABASE_URL in .env; found by dogfooding that
// exporting it per command is genuine friction. Minimal parse on
// purpose: one flat file, KEY=VALUE lines, optional quotes, no
// expansion and no cascade of .env.local variants.
export function readDotEnvDatabaseUrl(cwd = process.cwd()): string | undefined {
  let text: string;
  try {
    text = readFileSync(path.join(cwd, ".env"), "utf8");
  } catch {
    return undefined;
  }
  for (const line of text.split("\n")) {
    const m = /^\s*DATABASE_URL\s*=\s*("([^"]*)"|'([^']*)'|(.*?))\s*$/.exec(line);
    if (m) return m[2] ?? m[3] ?? m[4] ?? undefined;
  }
  return undefined;
}

export async function generateOnce(cfg: SupawatchConfig): Promise<void> {
  const sql = connect();
  try {
    const watcher = new Watcher({
      query: querierFrom(sql),
      schemas: cfg.schemas,
      includeViews: cfg.includeViews,
      barrel: cfg.barrel,
      profile: cfg.profile,
      targets: await buildTargetRuns(cfg),
      source: manualSource(),
    });
    const result = await watcher.runOnce();
    console.log(`[supawatch] generated ${result.files.length} files`);
    let failed = 0;
    for (const v of result.verified) {
      if (v.passed !== v.rows) failed++;
    }
    // one wording, shared with the watcher
    for (const line of describeVerified(result.verified)) {
      console.log(`[supawatch] ${line}`);
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
          includeViews: cfg.includeViews,
        })
      : listenSource(sql, () =>
          console.log("[supawatch] idle, listening on schema_changed"),
        );
  const watcher = new Watcher({
    query,
    schemas: cfg.schemas,
    includeViews: cfg.includeViews,
    barrel: cfg.barrel,
    profile: cfg.profile,
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
