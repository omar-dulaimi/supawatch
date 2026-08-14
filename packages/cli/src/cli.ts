#!/usr/bin/env node
import { loadConfig } from "./config.js";
import { init } from "./init.js";
import { generateOnce, watchForever } from "./run.js";

const USAGE = `supawatch <command>

commands:
  init      write the event-trigger migration and a starter config
  generate  introspect, generate, verify, write, once
  watch     run the live watcher (event trigger + LISTEN)
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
    default:
      console.log(USAGE);
      process.exitCode = command ? 1 : 0;
  }
}

main().catch((err) => {
  console.error(`[supawatch] ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
