import { MAPPED_PG_TYPES, type Snapshot } from "@supawatch/core";

// The harness fixture exercises EVERY row of core's runtime map, plus an
// enum and nullable variants. The completeness check below is what makes
// "every mapping row is verified" a build property instead of a hope.
export const FIXTURE_SQL = `
create type parcel_state as enum ('queued', 'shipped', 'lost');
create type dimensions as (width_mm int4, height_mm int4);
create domain tracking_code as text;
create domain weight_grams as int4;

create table parcels (
  size dimensions,
  tracking tracking_code not null default 'T-1',
  weight weight_grams not null default 250,
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
  shipped_on date not null default '2026-02-03',
  cutoff time not null default '13:45:10',
  cutoff_tz timetz not null default '13:45:10+02',
  transit interval not null default '1 day 02:00:00',
  stamp bytea not null default '\\xdeadbeef',
  source_ip inet not null default '192.168.0.1',
  subnet cidr not null default '10.0.0.0/8',
  device macaddr not null default '08:00:2b:01:02:03',
  tags text[] not null default array['x','y'],
  counts int4[] not null default array[1,2,3],
  amounts numeric[] not null default array['1.50']::numeric[],
  states parcel_state[] not null default array['queued']::parcel_state[],
  grid int4[][] not null default array[array[1,2],array[3,4]],
  note text
);

insert into parcels (note, size) values
  ('first', row(100, 40)::dimensions),
  (null, null);

-- Pathological but REAL values: floats can be NaN and infinities,
-- temporal columns can be 'infinity' (an Invalid Date at the driver),
-- and an enum can exist with zero labels. Every target must accept
-- these rows, because the database holds them.
create type unlabeled as enum ();
insert into parcels (note, ratio, wide, seen_at, shipped_on) values
  ('nan-row', 'NaN', 'NaN', 'infinity', 'infinity'),
  ('inf-row', 'Infinity', '-Infinity', '-infinity', '0044-03-15 BC');
alter table parcels add column phase unlabeled;

create view lost_parcels as
  select id, tracking, state from parcels where state = 'lost';
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
