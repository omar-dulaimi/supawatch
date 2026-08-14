import postgres from "postgres";
import { loadConfig } from "./config.js";
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
  const url = process.env.DATABASE_URL;

  results.push({
    name: "DATABASE_URL",
    ok: Boolean(url),
    detail: url ? "set" : "not set in the environment",
  });

  let sql: postgres.Sql | undefined;
  if (url) {
    sql = postgres(url, { max: 1, connect_timeout: 5 });
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
