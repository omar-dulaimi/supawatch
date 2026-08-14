import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const TRIGGER_SQL = `-- supawatch: one-time setup, reviewed like any migration.
-- The payload is only ever a wake-up bell; the watcher answers
-- "what changed" by diffing catalog snapshots.

create or replace function supawatch_notify_schema_change()
returns event_trigger
language plpgsql
as $$
begin
  perform pg_notify('schema_changed', tg_tag);
end;
$$;

drop event trigger if exists supawatch_schema_watcher;

create event trigger supawatch_schema_watcher
  on ddl_command_end
  execute function supawatch_notify_schema_change();
`;

const CONFIG_TS = `import { defineConfig } from "supawatch";

export default defineConfig({
  schemas: ["public"],
  outDir: "src/schemas",
  source: { kind: "listen", debounceMs: 300 },
  targets: [{ kind: "zod", strict: true }],
});
`;

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

export interface InitResult {
  migrationFile: string;
  configFile: string | null;
}

export async function init(cwd: string, log: (m: string) => void): Promise<InitResult> {
  // If this is a Supabase project, the trigger belongs in its migrations
  // dir so it ships with every environment; otherwise a local sql/ dir.
  const supabaseDir = path.join(cwd, "supabase", "migrations");
  const useSupabase = await exists(path.join(cwd, "supabase"));
  const dir = useSupabase ? supabaseDir : path.join(cwd, "sql");
  await mkdir(dir, { recursive: true });

  const stamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);
  const migrationFile = path.join(dir, `${stamp}_supawatch_event_trigger.sql`);
  await writeFile(migrationFile, TRIGGER_SQL);
  log(`wrote ${path.relative(cwd, migrationFile)}`);

  let configFile: string | null = path.join(cwd, "supawatch.config.ts");
  if (await exists(configFile)) {
    log("supawatch.config.ts already exists, leaving it alone");
    configFile = null;
  } else {
    await writeFile(configFile, CONFIG_TS);
    log("wrote supawatch.config.ts");
  }

  log("next: apply the migration, then run `supawatch watch` during dev");
  return { migrationFile, configFile };
}
