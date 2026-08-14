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

// Fallback for environments where the event trigger cannot be installed:
// hash the catalog snapshot every interval and wake when it changes.
// Slower and chattier than listen, but zero database setup.
export function pollSource(
  query: import("@supawatch/core").Querier,
  opts: { intervalMs?: number; schemas?: string[] } = {},
): TriggerSource {
  const intervalMs = opts.intervalMs ?? 5000;
  let timer: NodeJS.Timeout | null = null;
  let lastHash: string | undefined;
  return {
    name: "poll",
    async start(onWake) {
      const { introspect } = await import("@supawatch/core");
      const hashNow = async () =>
        JSON.stringify(await introspect(query, opts.schemas));
      lastHash = await hashNow();
      timer = setInterval(() => {
        void (async () => {
          try {
            const h = await hashNow();
            if (h !== lastHash) {
              lastHash = h;
              onWake("poll");
            }
          } catch {
            // A transient introspection failure is not a schema change;
            // the next tick tries again.
          }
        })();
      }, intervalMs);
    },
    async stop() {
      if (timer) clearInterval(timer);
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
