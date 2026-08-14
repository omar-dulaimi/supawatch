import { PGlite } from "@electric-sql/pglite";
import type { Querier } from "@supawatch/core";

// Adapts PGlite to core's query seam, so core tests need no Docker.
export function querierFromPglite(db: PGlite): Querier {
  return async <T = Record<string, unknown>>(text: string, params?: unknown[]) => {
    const result = await db.query<T>(text, params as unknown[]);
    return result.rows;
  };
}

export const FIXTURE_SQL = `
create type order_status as enum ('pending', 'paid', 'shipped');

create table users (
  id serial primary key,
  ref uuid not null default gen_random_uuid(),
  email text not null,
  display_name varchar(80),
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table orders (
  id serial primary key,
  user_id integer not null references users(id),
  status order_status not null default 'pending',
  total numeric(10, 2) not null,
  big_ref bigint,
  metadata jsonb,
  placed_at timestamptz not null default now()
);

insert into users (email, display_name, is_admin) values
  ('ada@example.test', 'Ada', true),
  ('lin@example.test', null, false);

insert into orders (user_id, status, total, big_ref, metadata) values
  (1, 'paid', '49.90', 9007199254740993, '{"source": "web"}'),
  (2, 'pending', '120.00', null, null);
`;
