#!/usr/bin/env bash
# End-to-end: real Postgres in Docker, driven entirely through the built CLI.
# Rerun-safe: the database schema and the output dir are reset each time.
set -euo pipefail
cd "$(dirname "$0")"

ROOT="$(cd .. && pwd)"
CLI="$ROOT/e2e/out-work/node_modules/.bin/supawatch"
export DATABASE_URL="postgres://postgres:e2e@localhost:5434/e2e"
PSQL="docker exec -i supawatch-e2e-pg psql -U postgres -d e2e -v ON_ERROR_STOP=1"
# Generated files live INSIDE the consumer project, like a real user's
# src/schemas, so the emitted import of "zod" resolves the consumer's copy.
OUT="$ROOT/e2e/out-work/generated"

wait_for_log() {
  local needle="$1" timeout="$2" i=0
  while [ "$i" -lt "$timeout" ]; do
    if awk -v n="$needle" 'index($0, n) { found = 1 } END { exit !found }' watch.log 2>/dev/null; then
      return 0
    fi
    sleep 1
    i=$((i + 1))
  done
  echo "TIMED OUT waiting for: $needle"
  echo "--- watch.log ---"
  cat watch.log 2>/dev/null || true
  return 1
}

echo "== 1. Postgres up =="
docker compose up -d --wait

echo "== 2. Reset schema and output =="
$PSQL -c 'drop schema if exists public cascade; create schema public;' >/dev/null
$PSQL < schema.sql >/dev/null
rm -rf "$OUT" out-work watch.log tars
mkdir -p out-work tars

echo "== 2b. Pack every package and install like a real consumer =="
# The consumer installs tarballs, not workspace links: this is the
# pack-install-run gate, catching files/exports defects a green working
# tree hides. Overrides point the scoped deps at their sibling tarballs.
for pkg in core target-zod target-valibot target-arktype target-typebox target-supabase-types watch cli; do
  (cd "$ROOT/packages/$pkg" && pnpm pack --pack-destination "$ROOT/e2e/tars" >/dev/null)
done
cat > out-work/package.json <<PKG
{
  "name": "e2e-consumer",
  "private": true,
  "type": "module",
  "dependencies": {
    "supawatch": "file:../tars/supawatch-0.1.0.tgz",
    "@sinclair/typebox": "^0.34.0",
    "arktype": "^2.1.0",
    "valibot": "^1.1.0",
    "zod": "^4.0.0"
  },
  "overrides": {
    "@supawatch/core": "file:../tars/supawatch-core-0.1.0.tgz",
    "@supawatch/target-arktype": "file:../tars/supawatch-target-arktype-0.1.0.tgz",
    "@supawatch/target-supabase-types": "file:../tars/supawatch-target-supabase-types-0.1.0.tgz",
    "@supawatch/target-typebox": "file:../tars/supawatch-target-typebox-0.1.0.tgz",
    "@supawatch/target-valibot": "file:../tars/supawatch-target-valibot-0.1.0.tgz",
    "@supawatch/target-zod": "file:../tars/supawatch-target-zod-0.1.0.tgz",
    "@supawatch/watch": "file:../tars/supawatch-watch-0.1.0.tgz"
  }
}
PKG
(cd out-work && npm install --silent --no-audit --no-fund)

echo "== 3. supawatch init (writes the trigger migration and config) =="
cd out-work
$CLI init
cd ..

echo "== 4. Apply the generated trigger migration =="
$PSQL < out-work/sql/*_supawatch_event_trigger.sql >/dev/null

echo "== 5. Point config at e2e/out and start supawatch watch =="
cat > out-work/supawatch.config.ts <<CFG
import { defineConfig } from "supawatch";

export default defineConfig({
  schemas: ["public"],
  outDir: "$OUT",
  source: { kind: "listen", debounceMs: 300 },
  jsonTypes: { "orders.metadata": "{ source?: string; coupon?: string }" },
  targets: [
    { kind: "zod", strict: true, emit: { insert: true, update: true } },
    { kind: "valibot", strict: true },
    { kind: "arktype", strict: true },
    { kind: "typebox", strict: true },
  ],
});
CFG

echo "== 5b. doctor before the trigger check (sanity of the whole path) =="
(cd out-work && "$CLI" doctor) || fail_doctor=1
if [ "${fail_doctor:-0}" -eq 1 ]; then echo "E2E FAILED: doctor reported unhealthy"; exit 1; fi
# exec replaces the subshell, so $! is the watcher itself; setsid makes
# that pid its own process group, so kill -- -$! reaches the whole tree.
(cd out-work && exec setsid "$CLI" watch > ../watch.log 2>&1 < /dev/null) &
WATCHER_PID=$!
trap 'kill -- "-$WATCHER_PID" 2>/dev/null || true' EXIT
wait_for_log "idle, listening" 30

echo "== 6. Live DDL: add a column =="
$PSQL -c 'alter table orders add column refund_reason text;' >/dev/null
wait_for_log "orders gained refund_reason" 15
sleep 1

echo "== 7. Live DDL burst: enum value + new table =="
$PSQL -c "alter type order_status add value 'refunded';" >/dev/null
$PSQL -c 'create table refunds (id serial primary key, order_id integer not null, amount numeric(10,2) not null);' >/dev/null
$PSQL -c "insert into refunds (order_id, amount) values (1, '49.90');" >/dev/null
wait_for_log "table public.refunds created" 15
sleep 1

echo "== 7b. Live DDL: a view appears =="
$PSQL -c 'create view refunded_orders as select o.id, r.amount from orders o join refunds r on r.order_id = o.id;' >/dev/null
wait_for_log "view public.refunded_orders created" 15
sleep 1

echo "== 8. Stop watcher =="
kill -- "-$WATCHER_PID" 2>/dev/null || true
wait "$WATCHER_PID" 2>/dev/null || true
trap - EXIT

echo "== 9. Assertions =="
fail() { echo "E2E FAILED: $1"; exit 1; }
awk 'index($0, "FAILED") { bad = 1 } END { exit bad }' watch.log || fail "a ground-truth check failed"
awk -v n="ground-truth check, refunds: 1/1 passed" 'index($0, n) { f = 1 } END { exit !f }' watch.log || fail "refunds not verified"
[ -f "$OUT/zod/orders.mjs" ] || fail "orders.mjs missing"
[ -f "$OUT/zod/orders.d.mts" ] || fail "orders.d.mts missing"
awk 'index($0, "refund_reason") { f = 1 } END { exit !f }' "$OUT/zod/orders.mjs" || fail "regenerated schema lacks refund_reason"
awk -v n="\"refunded\"" 'index($0, n) { f = 1 } END { exit !f }' "$OUT/zod/orders.mjs" || fail "enum value refunded missing"
[ -f "$OUT/valibot/orders.mjs" ] || fail "valibot orders.mjs missing"
awk 'index($0, "v.picklist") && index($0, "\"refunded\"") { f = 1 } END { exit !f }' "$OUT/valibot/orders.mjs" || fail "valibot enum missing refunded"
[ -f "$OUT/arktype/orders.mjs" ] || fail "arktype orders.mjs missing"
awk "index(\$0, \"'refunded'\") { f = 1 } END { exit !f }" "$OUT/arktype/orders.mjs" || fail "arktype enum missing refunded"
[ -f "$OUT/typebox/orders.mjs" ] || fail "typebox orders.mjs missing"
awk 'index($0, "Type.Literal(\"refunded\")") { f = 1 } END { exit !f }' "$OUT/typebox/orders.mjs" || fail "typebox enum missing refunded"
awk 'index($0, "\"totals\": z.string().nullable()") { f = 1 } END { exit !f }' "$OUT/zod/orders.mjs" || fail "composite column not mapped to string"
awk 'index($0, "\"tags\": z.array(z.string())") { f = 1 } END { exit !f }' "$OUT/zod/orders.mjs" || fail "array column not mapped"
awk 'index($0, "\"expires_on\": z.date().nullable()") { f = 1 } END { exit !f }' "$OUT/zod/orders.mjs" || fail "date column not mapped"
awk 'index($0, "\"receipt\": z.instanceof(Uint8Array).nullable()") { f = 1 } END { exit !f }' "$OUT/zod/orders.mjs" || fail "bytea column not mapped"
awk 'index($0, "\"email\": z.string()") { f = 1 } END { exit !f }' "$OUT/zod/users.mjs" || fail "domain column not resolved to base string"
[ -f "$OUT/zod/paid_orders.mjs" ] || fail "view paid_orders not emitted"
[ -f "$OUT/zod/refunded_orders.mjs" ] || fail "live-created view not emitted"
[ -f "$OUT/zod/index.mjs" ] || fail "zod barrel missing"
awk 'index($0, "./orders.mjs") { f = 1 } END { exit !f }' "$OUT/zod/index.mjs" || fail "barrel lacks orders entry"
awk 'index($0, "ordersInsert") { f = 1 } END { exit !f }' "$OUT/zod/orders.mjs" || fail "insert variant missing"
awk 'index($0, "\"id\": z.number().int().optional()") { f = 1 } END { exit !f }' "$OUT/zod/orders.mjs" || fail "serial id not optional in insert"
awk 'index($0, "ordersUpdate") { f = 1 } END { exit !f }' "$OUT/zod/orders.mjs" || fail "update variant missing"
awk 'index($0, "source?: string") { f = 1 } END { exit !f }' "$OUT/zod/orders.d.mts" || fail "jsonTypes override missing from d.mts"
node -e "import('file://$OUT/zod/index.mjs').then((m) => { if (!m.ordersRow || !m.usersRow || !m.ordersInsert) { console.error('barrel exports incomplete'); process.exit(1); } })" || fail "barrel does not import cleanly"

echo "== 10. check: clean tree passes, tampering fails =="
(cd out-work && "$CLI" check) || fail "check reported drift on a clean tree"
printf '// tampered\n' >> "$OUT/zod/orders.mjs"
if (cd out-work && "$CLI" check > ../check-drift.log 2>&1); then
  fail "check missed hand-edited drift"
fi
awk 'index($0, "drift (stale)") { f = 1 } END { exit !f }' check-drift.log || fail "check did not name the stale file"
(cd out-work && "$CLI" generate >/dev/null) || fail "generate could not repair drift"
(cd out-work && "$CLI" check) || fail "check still drifting after regenerate"

echo "== 11. supabase-js profile: generate for PostgREST and verify against the real thing =="
PROUT="$ROOT/e2e/out-work/generated-postgrest"
cat > out-work/supawatch.config.ts <<CFG
import { defineConfig } from "supawatch";

export default defineConfig({
  schemas: ["public"],
  outDir: "$PROUT",
  profile: "supabase-js",
  source: { kind: "manual" },
  targets: [{ kind: "zod", strict: true }, { kind: "supabase-types" }],
});
CFG
(cd out-work && "$CLI" generate) || fail "supabase-js profile generate failed"
[ -f "$PROUT/database.types.ts" ] || fail "database.types.ts missing"
awk 'index($0, "export interface Database") { f = 1 } END { exit !f }' "$PROUT/database.types.ts" || fail "Database interface missing"
awk 'index($0, "orders_user_id_fkey") { f = 1 } END { exit !f }' "$PROUT/database.types.ts" || fail "FK relationship missing"
awk 'index($0, "order_status:") { f = 1 } END { exit !f }' "$PROUT/database.types.ts" || fail "enum missing from bridge"
awk 'index($0, "total: number;") { f = 1 } END { exit !f }' "$PROUT/database.types.ts" || fail "numeric not number in bridge Row"
awk 'index($0, "\"total\": z.number()") { f = 1 } END { exit !f }' "$PROUT/zod/orders.mjs" || fail "profile zod schema still string for numeric"

echo "== 11b. Ground truth for the profile: parse real PostgREST JSON =="
docker exec -i supawatch-e2e-pg psql -U postgres -d e2e -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
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
docker rm -f supawatch-postgrest >/dev/null 2>&1 || true
docker run -d --rm --name supawatch-postgrest --network e2e_default -p 3001:3000 \
  -e PGRST_DB_URI="postgres://postgres:e2e@db:5432/e2e" \
  -e PGRST_DB_SCHEMAS="public" \
  -e PGRST_DB_ANON_ROLE="web_anon" \
  postgrest/postgrest >/dev/null
trap 'docker rm -f supawatch-postgrest >/dev/null 2>&1 || true' EXIT
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sf http://localhost:3001/orders >/dev/null 2>&1; then break; fi
  sleep 1
done
(cd out-work && node -e '
const schemaUrl = "file://" + process.argv[1] + "/zod/orders.mjs";
Promise.all([import(schemaUrl), fetch("http://localhost:3001/orders").then((r) => r.json())])
  .then(([mod, rows]) => {
    if (!Array.isArray(rows) || rows.length === 0) { console.error("no rows from postgrest"); process.exit(1); }
    for (const row of rows) {
      const v = mod.ordersRow.safeParse(row);
      if (!v.success) { console.error("profile ground truth FAILED:", v.error.issues[0]); process.exit(1); }
    }
    console.log(`profile ground truth: ${rows.length}/${rows.length} PostgREST rows passed`);
  });
' "$PROUT") || fail "generated supabase-js schema rejected real PostgREST rows"
docker rm -f supawatch-postgrest >/dev/null 2>&1 || true
trap - EXIT

echo
echo "================ watch.log ================"
cat watch.log
echo
echo "E2E PASSED. Postgres still running; stop with: docker compose -f e2e/docker-compose.yml down"
