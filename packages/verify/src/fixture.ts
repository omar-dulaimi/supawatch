import { MAPPED_PG_TYPES, type Snapshot } from "@supawatch/core";

// The harness fixture exercises EVERY row of core's runtime map, plus an
// enum and nullable variants. The completeness check below is what makes
// "every mapping row is verified" a build property instead of a hope.
export const FIXTURE_SQL = `
create type parcel_state as enum ('queued', 'shipped', 'lost');

create table parcels (
  id serial primary key,
  small int2 not null default 1,
  big int8 not null default 9007199254740993,
  ratio float4 not null default 0.5,
  wide float8 not null default 2.25,
  price numeric(10,2) not null default 19.99,
  ref uuid not null default gen_random_uuid(),
  label text not null default 'x',
  short_code varchar(12) not null default 'abc',
  padded bpchar(4) not null default 'ab',
  active bool not null default true,
  seen_at timestamptz not null default now(),
  local_at timestamp not null default now(),
  blob_j json not null default '{"a":1}',
  blob_jb jsonb not null default '{"b":2}',
  state parcel_state not null default 'queued',
  note text
);

insert into parcels (note) values ('first'), (null);
`;

export function assertFixtureCompleteness(snapshot: Snapshot): void {
  const seen = new Set<string>();
  for (const table of snapshot.tables) {
    for (const col of table.columns) seen.add(col.pgTypeName);
  }
  const missing = MAPPED_PG_TYPES.filter((t) => !seen.has(t));
  if (missing.length > 0) {
    throw new Error(
      `runtime-map rows with no fixture coverage: ${missing.join(", ")}; ` +
        "add columns to the harness fixture before adding mapping rows",
    );
  }
}
