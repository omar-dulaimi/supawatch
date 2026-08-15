import type postgres from "postgres";

export interface TriggerSource {
  readonly name: string;
  start(onWake: (hint: string) => void): Promise<void>;
  stop(): Promise<void>;
}

// The default source: the event trigger rings pg_notify('schema_changed'),
// postgres.js holds a dedicated LISTEN connection that reconnects itself.
// The ready callback fires on the initial connect AND on every reconnect;
// a reconnect wakes the watcher, because DDL applied while the connection
// was down produced notifications nobody heard. The diff makes a false
// wake free: no structural change, no regeneration.
export function listenSource(
  sql: postgres.Sql,
  onReady?: () => void,
): TriggerSource {
  let handle: { unlisten: () => Promise<void> } | undefined;
  let readyCount = 0;
  return {
    name: "listen",
    async start(onWake) {
      handle = await sql.listen("schema_changed", onWake, () => {
        readyCount++;
        onReady?.();
        if (readyCount > 1) onWake("listen-reconnect");
      });
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
  opts: { intervalMs?: number; schemas?: string[]; includeViews?: boolean } = {},
): TriggerSource {
  const intervalMs = opts.intervalMs ?? 5000;
  let timer: NodeJS.Timeout | null = null;
  let lastHash: string | undefined;
  return {
    name: "poll",
    async start(onWake) {
      const { introspect } = await import("@supawatch/core");
      const hashNow = async () =>
        JSON.stringify(
          await introspect(query, opts.schemas, {
            includeViews: opts.includeViews,
          }),
        );
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
