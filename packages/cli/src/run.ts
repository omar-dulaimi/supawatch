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
import type { Querier } from "@supawatch/core";
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
// Only parameters a connection pooler will accept at startup.
// PgBouncer and Supavisor allow a small tracked set (DateStyle among
// them) and reject the rest outright with "unsupported startup
// parameter", which would make supawatch unable to connect at all
// through Supabase's pooled port. The settings that cannot be sent
// safely are reported instead of forced; see warnAboutDriverSettings.
export const DRIVER_TRUTH_SETTINGS = {
  DateStyle: "ISO, MDY",
} as const;

// bytea_output=escape silently decodes 8 bytes as 1 wrong byte and a
// non-ISO DateStyle swaps day and month. supawatch pins DateStyle, but a
// pooled connection cannot be forced, so say so rather than emit
// verified-looking garbage.
export async function warnAboutDriverSettings(sql: postgres.Sql): Promise<void> {
  try {
    const [s] = await sql<{ datestyle: string; bytea_output: string }[]>`
      select current_setting('DateStyle') as datestyle,
             current_setting('bytea_output') as bytea_output`;
    const problems: string[] = [];
    if (!s.datestyle.startsWith("ISO")) {
      problems.push(`DateStyle is ${s.datestyle}, so dates decode with day and month swapped`);
    }
    if (s.bytea_output !== "hex") {
      problems.push(`bytea_output is ${s.bytea_output}, so bytea values decode incorrectly`);
    }
    if (problems.length > 0) {
      console.warn(
        `[supawatch] warning: ${problems.join("; ")}. Values read from this database are not trustworthy; ` +
          `set these on the database or role (alter database ... set bytea_output = 'hex').`,
      );
    }
  } catch {
    // current_setting is not worth failing a run over
  }
}

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
    await warnAboutDriverSettings(sql);
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
  // Two connections on purpose. The LISTEN connection must stay up for
  // the life of the watcher, while the query connection gets recycled
  // whenever custom types change, because the driver only learns type
  // parsers at connect time.
  const sql = connect();
  let querySql = connect();
  await warnAboutDriverSettings(querySql);
  // resolved per call, so a reconnect is picked up immediately
  const query: Querier = (text, params) => querierFrom(querySql)(text, params);
  const refreshTypes = async () => {
    const old = querySql;
    querySql = connect();
    await old.end();
  };
  const debounceMs = cfg.source.kind === "listen" ? cfg.source.debounceMs : undefined;
  const source =
    cfg.source.kind === "poll"
      ? pollSource(query, {
          intervalMs: cfg.source.intervalMs,
          schemas: cfg.schemas,
          includeViews: cfg.includeViews,
        })
      : listenSource(
          sql,
          () => console.log("[supawatch] idle, listening on schema_changed"),
          (problem) => console.warn(`[supawatch] warning: ${problem}`),
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
    refreshTypes,
  });
  const shutdown = async () => {
    await watcher.stop();
    await Promise.all([sql.end(), querySql.end()]);
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  await watcher.start();
}
