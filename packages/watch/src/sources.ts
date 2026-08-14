import type postgres from "postgres";

export interface TriggerSource {
  readonly name: string;
  start(onWake: (hint: string) => void): Promise<void>;
  stop(): Promise<void>;
}

// The default source: the event trigger rings pg_notify('schema_changed'),
// postgres.js holds a dedicated LISTEN connection that reconnects itself.
export function listenSource(
  sql: postgres.Sql,
  onReady?: () => void,
): TriggerSource {
  let handle: { unlisten: () => Promise<void> } | undefined;
  return {
    name: "listen",
    async start(onWake) {
      handle = await sql.listen("schema_changed", onWake, onReady);
    },
    async stop() {
      await handle?.unlisten();
    },
  };
}

// One shot: what `supawatch generate` and CI use. The watch runtime and the
// one-shot command are the same code path with a different source.
export function manualSource(): TriggerSource & { fire(hint?: string): void } {
  let wake: ((hint: string) => void) | undefined;
  return {
    name: "manual",
    async start(onWake) {
      wake = onWake;
    },
    async stop() {
      wake = undefined;
    },
    fire(hint = "manual") {
      wake?.(hint);
    },
  };
}
