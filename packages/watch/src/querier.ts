import type postgres from "postgres";
import type { Querier } from "@supawatch/core";

// Adapts a postgres.js connection to core's driver-neutral query seam.
export function querierFrom(sql: postgres.Sql): Querier {
  return async <T = Record<string, unknown>>(text: string, params?: unknown[]) => {
    const rows = await sql.unsafe(text, (params ?? []) as never[]);
    return rows as unknown as T[];
  };
}
