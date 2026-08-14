#!/usr/bin/env node
import { loadConfig } from "./config.js";
import { init } from "./init.js";
import { generateOnce, watchForever } from "./run.js";

const USAGE = `supawatch <command>

commands:
  init      write the event-trigger migration and a starter config
  generate  introspect, generate, verify, write, once
  watch     run the live watcher (event trigger + LISTEN)
  check     CI drift gate: regenerate in memory, diff against disk, no writes
  doctor    verify the setup end to end: connection, trigger, listen, targets
`;

async function main() {
  const command = process.argv[2];
  const cwd = process.cwd();
  switch (command) {
    case "init":
      await init(cwd, (m) => console.log(`[supawatch] ${m}`));
      return;
    case "generate":
      await generateOnce(await loadConfig(cwd));
      return;
    case "watch":
      await watchForever(await loadConfig(cwd));
      return;
    case "check": {
      const { check } = await import("./check.js");
      const drift = await check(await loadConfig(cwd));
      if (drift.length === 0) {
        console.log("[supawatch] check: no drift");
        return;
      }
      for (const d of drift) {
        console.log(`[supawatch] drift (${d.kind}): ${d.file}`);
      }
      process.exitCode = 1;
      return;
    }
    case "doctor": {
      const { doctor } = await import("./doctor.js");
      const healthy = await doctor(cwd);
      if (!healthy) process.exitCode = 1;
      return;
    }
    default:
      console.log(USAGE);
      process.exitCode = command ? 1 : 0;
  }
}

main().catch((err) => {
  console.error(`[supawatch] ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
