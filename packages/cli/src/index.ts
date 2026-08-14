export { defineConfig, loadConfig, ConfigSchema, TARGET_KINDS } from "./config.js";
export type { SupawatchConfig, TargetConfigItem } from "./config.js";
export { TARGETS, entryFor, loadTarget } from "./registry.js";
export { init } from "./init.js";
export { buildTargetRuns, generateOnce, watchForever } from "./run.js";
export { check, type Drift } from "./check.js";
