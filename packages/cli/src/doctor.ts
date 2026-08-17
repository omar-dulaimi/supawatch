import postgres from "postgres";
import { loadConfig } from "./config.js";
import { DRIVER_TRUTH_SETTINGS, readDotEnvDatabaseUrl } from "./run.js";
import { entryFor, loadTarget } from "./registry.js";

interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

// Doctor prints what it verified, never what it assumes. Each check does
// the real thing: the LISTEN check round-trips an actual notification.
export async function doctor(cwd: string): Promise<boolean> {
  const results: CheckResult[] = [];
  const url = process.env.DATABASE_URL ?? readDotEnvDatabaseUrl();

  results.push({
    name: "DATABASE_URL",
    ok: Boolean(url),
    detail: url
      ? process.env.DATABASE_URL
        ? "set"
        : "read from ./.env"
      : "not set in the environment or ./.env",
  });

  let sql: postgres.Sql | undefined;
  if (url) {
    sql = postgres(url, {
      max: 1,
      connect_timeout: 5,
      connection: { ...DRIVER_TRUTH_SETTINGS },
    });
    try {
      await sql`select 1`;
      results.push({ name: "connect", ok: true, detail: "select 1 succeeded" });
    } catch (err) {
      results.push({
        name: "connect",
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
      });
      sql = undefined;
    }
  }

  if (sql) {
    // supawatch pins these on its own connections, so it always reads
    // the truth. A consumer's driver does not: with bytea_output=escape
    // an 8 byte value decodes to 1 wrong byte, and with a non-ISO
    // DateStyle a date comes back with day and month swapped, both
    // silently. Report what a plain connection would inherit.
    const plain = postgres(url!, { max: 1, connect_timeout: 5 });
    try {
      const [defaults] = await plain<
        { datestyle: string; bytea_output: string }[]
      >`select current_setting('DateStyle') as datestyle,
               current_setting('bytea_output') as bytea_output`;
      const problems: string[] = [];
      if (!defaults.datestyle.startsWith("ISO")) {
        problems.push(`DateStyle is ${defaults.datestyle} (dates decode wrong; want ISO)`);
      }
      if (defaults.bytea_output !== "hex") {
        problems.push(`bytea_output is ${defaults.bytea_output} (bytea decodes wrong; want hex)`);
      }
      results.push({
        name: "driver settings",
        ok: problems.length === 0,
        detail:
          problems.length === 0
            ? "DateStyle ISO and bytea_output hex, so driver values are truthful"
            : `${problems.join("; ")}. supawatch pins these for itself, but your app's own connection will read corrupted values unless it does the same`,
      });
    } finally {
      await plain.end();
    }

    const triggers = await sql`
      select evtname from pg_event_trigger
      where evtname = 'supawatch_schema_watcher'
    `;
    results.push({
      name: "event trigger",
      ok: triggers.length === 1,
      detail:
        triggers.length === 1
          ? "supawatch_schema_watcher installed"
          : "not installed; run supawatch init and apply the migration",
    });

    // Round-trip a real notification rather than assuming LISTEN works.
    const received = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), 3000);
      void sql!
        .listen("supawatch_doctor", () => {
          clearTimeout(timer);
          resolve(true);
        })
        .then(() => sql!`select pg_notify('supawatch_doctor', 'ping')`)
        .catch(() => {
          clearTimeout(timer);
          resolve(false);
        });
    });
    results.push({
      name: "listen/notify",
      ok: received,
      detail: received
        ? "round-tripped a notification"
        : "no notification arrived within 3s",
    });
  }

  try {
    const cfg = await loadConfig(cwd);
    results.push({
      name: "config",
      ok: true,
      detail: `${cfg.targets.length} target(s), source ${cfg.source.kind}`,
    });
    for (const t of cfg.targets) {
      try {
        await loadTarget(entryFor(t.kind));
        results.push({ name: `target ${t.kind}`, ok: true, detail: "loads" });
      } catch (err) {
        results.push({
          name: `target ${t.kind}`,
          ok: false,
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } catch (err) {
    results.push({
      name: "config",
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  for (const r of results) {
    console.log(`[supawatch] ${r.ok ? "ok  " : "FAIL"} ${r.name}: ${r.detail}`);
  }
  await sql?.end();
  return results.every((r) => r.ok);
}
