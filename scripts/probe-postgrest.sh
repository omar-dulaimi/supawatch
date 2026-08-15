#!/usr/bin/env bash
# Measures what PostgREST's JSON actually contains per Postgres type,
# using the e2e database. Run after e2e/demo.sh has left Postgres up.
set -euo pipefail
cd "$(dirname "$0")/.."

PSQL="docker exec -i supawatch-e2e-pg psql -U postgres -d e2e -v ON_ERROR_STOP=1"

$PSQL <<'SQL' >/dev/null
drop table if exists profile_probe;
create table profile_probe (
  id serial primary key,
  big int8 not null default 9007199254740993,
  price numeric(10,2) not null default 19.99,
  ratio float8 not null default 2.25,
  ref uuid not null default gen_random_uuid(),
  label text not null default 'x',
  active bool not null default true,
  seen_at timestamptz not null default now(),
  shipped_on date not null default '2026-02-03',
  cutoff time not null default '13:45:10',
  transit interval not null default '1 day 02:00:00',
  stamp bytea not null default '\xdeadbeef',
  source_ip inet not null default '192.168.0.1',
  tags text[] not null default array['x','y'],
  counts int4[] not null default array[1,2,3],
  amounts numeric[] not null default array['1.50']::numeric[],
  states order_status[] not null default array['pending']::order_status[],
  meta jsonb not null default '{"a":1}',
  state order_status not null default 'pending'
);
insert into profile_probe default values;
do $$ begin
  if exists (select from pg_roles where rolname = 'web_anon') then
    execute 'drop owned by web_anon';
    execute 'drop role web_anon';
  end if;
end $$;
create role web_anon nologin;
grant usage on schema public to web_anon;
grant select on all tables in schema public to web_anon;
SQL
echo "probe table ready"

docker rm -f supawatch-postgrest >/dev/null 2>&1 || true
docker run -d --rm --name supawatch-postgrest --network e2e_default -p 3001:3000 \
  -e PGRST_DB_URI="postgres://postgres:e2e@db:5432/e2e" \
  -e PGRST_DB_SCHEMAS="public" \
  -e PGRST_DB_ANON_ROLE="web_anon" \
  postgrest/postgrest >/dev/null

for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sf http://localhost:3001/profile_probe >/dev/null 2>&1; then break; fi
  sleep 1
done

node -e '
fetch("http://localhost:3001/profile_probe")
  .then((r) => r.json())
  .then((rows) => {
    const row = rows[0];
    for (const [k, v] of Object.entries(row)) {
      const t = Array.isArray(v) ? `array<${typeof v[0]}>` : typeof v;
      console.log(`${k}: ${t} = ${JSON.stringify(v)}`);
    }
  });
'
