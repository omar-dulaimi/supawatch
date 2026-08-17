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
for pkg in core target-zod target-valibot target-arktype target-typebox target-supabase-types target-erd target-schema-lock target-json-schema target-fast-check target-forms target-factories target-trpc target-schema-card target-dictionary target-realtime target-mcp target-ai-tools target-seed target-effect target-rest target-service target-orpc target-graphql target-pgtap target-rls target-pgmq watch cli; do
  (cd "$ROOT/packages/$pkg" && pnpm pack --pack-destination "$ROOT/e2e/tars" >/dev/null)
done
pv() { node -p "require('$ROOT/packages/$1/package.json').version"; }
V_CARD=$(pv target-schema-card); V_DICT=$(pv target-dictionary); V_RT=$(pv target-realtime)
V_MCP=$(pv target-mcp); V_AI=$(pv target-ai-tools); V_SEED=$(pv target-seed)
V_EFF=$(pv target-effect); V_REST=$(pv target-rest); V_SVC=$(pv target-service)
V_ORPC=$(pv target-orpc); V_GQL=$(pv target-graphql); V_TAP=$(pv target-pgtap)
V_RLS=$(pv target-rls); V_PGMQ=$(pv target-pgmq)
V=$(pv core)
V_ERD=$(pv target-erd); V_LOCK=$(pv target-schema-lock); V_JS=$(pv target-json-schema)
V_FC=$(pv target-fast-check); V_FORMS=$(pv target-forms); V_FACT=$(pv target-factories)
V_TRPC=$(pv target-trpc); V_ZOD=$(pv target-zod); V_VALI=$(pv target-valibot)
V_ARK=$(pv target-arktype); V_TB=$(pv target-typebox); V_ST=$(pv target-supabase-types)
V_WATCH=$(pv watch); V_CLI=$(pv cli)
cat > out-work/package.json <<PKG
{
  "name": "e2e-consumer",
  "private": true,
  "type": "module",
  "dependencies": {
    "supawatch": "file:../tars/supawatch-${V_CLI}.tgz",
    "@sinclair/typebox": "^0.34.0",
    "fast-check": "^4.0.0",
    "@trpc/server": "^11.0.0",
    "@supabase/supabase-js": "^2.45.0",
    "@modelcontextprotocol/sdk": "^1.0.0",
    "ai": "^5.0.0",
    "effect": "^3.10.0",
    "hono": "^4.6.0",
    "@orpc/server": "^1.0.0",
    "@pothos/core": "^4.0.0",
    "graphql": "^16.9.0",
    "typescript": "^5.9.0",
    "arktype": "^2.1.0",
    "valibot": "^1.1.0",
    "zod": "^4.0.0"
  },
  "overrides": {
    "@supawatch/core": "file:../tars/supawatch-core-${V}.tgz",
    "@supawatch/target-arktype": "file:../tars/supawatch-target-arktype-${V_ARK}.tgz",
    "@supawatch/target-erd": "file:../tars/supawatch-target-erd-${V_ERD}.tgz",
    "@supawatch/target-schema-lock": "file:../tars/supawatch-target-schema-lock-${V_LOCK}.tgz",
    "@supawatch/target-json-schema": "file:../tars/supawatch-target-json-schema-${V_JS}.tgz",
    "@supawatch/target-fast-check": "file:../tars/supawatch-target-fast-check-${V_FC}.tgz",
    "@supawatch/target-forms": "file:../tars/supawatch-target-forms-${V_FORMS}.tgz",
    "@supawatch/target-factories": "file:../tars/supawatch-target-factories-${V_FACT}.tgz",
    "@supawatch/target-trpc": "file:../tars/supawatch-target-trpc-${V_TRPC}.tgz",
    "@supawatch/target-schema-card": "file:../tars/supawatch-target-schema-card-${V_CARD}.tgz",
    "@supawatch/target-dictionary": "file:../tars/supawatch-target-dictionary-${V_DICT}.tgz",
    "@supawatch/target-realtime": "file:../tars/supawatch-target-realtime-${V_RT}.tgz",
    "@supawatch/target-mcp": "file:../tars/supawatch-target-mcp-${V_MCP}.tgz",
    "@supawatch/target-ai-tools": "file:../tars/supawatch-target-ai-tools-${V_AI}.tgz",
    "@supawatch/target-seed": "file:../tars/supawatch-target-seed-${V_SEED}.tgz",
    "@supawatch/target-effect": "file:../tars/supawatch-target-effect-${V_EFF}.tgz",
    "@supawatch/target-rest": "file:../tars/supawatch-target-rest-${V_REST}.tgz",
    "@supawatch/target-service": "file:../tars/supawatch-target-service-${V_SVC}.tgz",
    "@supawatch/target-orpc": "file:../tars/supawatch-target-orpc-${V_ORPC}.tgz",
    "@supawatch/target-graphql": "file:../tars/supawatch-target-graphql-${V_GQL}.tgz",
    "@supawatch/target-pgtap": "file:../tars/supawatch-target-pgtap-${V_TAP}.tgz",
    "@supawatch/target-rls": "file:../tars/supawatch-target-rls-${V_RLS}.tgz",
    "@supawatch/target-pgmq": "file:../tars/supawatch-target-pgmq-${V_PGMQ}.tgz",
    "@supawatch/target-supabase-types": "file:../tars/supawatch-target-supabase-types-${V_ST}.tgz",
    "@supawatch/target-typebox": "file:../tars/supawatch-target-typebox-${V_TB}.tgz",
    "@supawatch/target-valibot": "file:../tars/supawatch-target-valibot-${V_VALI}.tgz",
    "@supawatch/target-zod": "file:../tars/supawatch-target-zod-${V_ZOD}.tgz",
    "@supawatch/watch": "file:../tars/supawatch-watch-${V_WATCH}.tgz"
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
    { kind: "erd" },
    { kind: "schema-lock" },
    { kind: "json-schema", strict: true },
    { kind: "fast-check" },
    { kind: "forms" },
    { kind: "factories" },
    { kind: "trpc" },
    { kind: "schema-card" },
    { kind: "dictionary" },
    { kind: "realtime" },
    { kind: "mcp" },
    { kind: "ai-tools" },
    { kind: "seed", rows: 2 },
    { kind: "effect" },
    { kind: "rest" },
    { kind: "service" },
    { kind: "orpc" },
    { kind: "graphql" },
    { kind: "pgtap" },
    { kind: "rls" },
    { kind: "pgmq" },
    { kind: "supabase-types", path: "$OUT" },
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

echo "== 7a2. Live DDL: a comment lands =="
$PSQL -c "comment on column orders.total is 'Gross amount, tax included.';" >/dev/null
wait_for_log "comment on public.orders.total changed" 15
sleep 1

echo "== 7b. Live DDL: a view appears =="
$PSQL -c 'create view refunded_orders as select o.id, r.amount from orders o join refunds r on r.order_id = o.id;' >/dev/null
wait_for_log "view public.refunded_orders created" 15
sleep 1

echo "== 7c. Live DDL: rls enabled and a policy created =="
$PSQL -c 'alter table orders enable row level security;' >/dev/null
$PSQL -c 'create policy orders_read on orders for select using (true);' >/dev/null
wait_for_log "rls enabled on public.orders" 15
wait_for_log "policy orders_read created on public.orders" 15
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
awk 'index($0, "\"expires_on\": z.instanceof(Date).nullable()") { f = 1 } END { exit !f }' "$OUT/zod/orders.mjs" || fail "date column not mapped"
awk 'index($0, "\"receipt\": z.instanceof(Uint8Array).nullable()") { f = 1 } END { exit !f }' "$OUT/zod/orders.mjs" || fail "bytea column not mapped"
awk 'index($0, "\"email\": z.string()") { f = 1 } END { exit !f }' "$OUT/zod/users.mjs" || fail "domain column not resolved to base string"
[ -f "$OUT/zod/paid_orders.mjs" ] || fail "view paid_orders not emitted"
[ -f "$OUT/zod/refunded_orders.mjs" ] || fail "live-created view not emitted"
[ -f "$OUT/zod/index.mjs" ] || fail "zod barrel missing"
[ -f "$OUT/zod/index.d.mts" ] || fail "zod declaration barrel missing"
awk 'index($0, "./orders.mjs") { f = 1 } END { exit !f }' "$OUT/zod/index.mjs" || fail "barrel lacks orders entry"
awk 'index($0, "ordersInsert") { f = 1 } END { exit !f }' "$OUT/zod/orders.mjs" || fail "insert variant missing"
awk 'index($0, "\"id\": z.number().int().optional()") { f = 1 } END { exit !f }' "$OUT/zod/orders.mjs" || fail "serial id not optional in insert"
awk 'index($0, "ordersUpdate") { f = 1 } END { exit !f }' "$OUT/zod/orders.mjs" || fail "update variant missing"
awk 'index($0, "source?: string") { f = 1 } END { exit !f }' "$OUT/zod/orders.d.mts" || fail "jsonTypes override missing from d.mts"
node -e "import('file://$OUT/zod/index.mjs').then((m) => { if (!m.ordersRow || !m.usersRow || !m.ordersInsert) { console.error('barrel exports incomplete'); process.exit(1); } })" || fail "barrel does not import cleanly"

echo "== 9b. batch-1 target assertions =="
[ -f "$OUT/schema.erd.md" ] || fail "erd missing"
awk 'index($0, "erDiagram") { f = 1 } END { exit !f }' "$OUT/schema.erd.md" || fail "erd lacks erDiagram"
awk 'index($0, "orders }o--|| users") { f = 1 } END { exit !f }' "$OUT/schema.erd.md" || fail "erd lacks orders->users edge"
[ -f "$OUT/schema.lock.json" ] || fail "schema lock missing"
node -e "const l = require('$OUT/schema.lock.json'); if (typeof l.format !== 'number' || l.format < 2 || !l.tables.some(t => t.name === 'orders') || !('rlsEnabled' in l.tables[0])) process.exit(1)" || fail "schema lock malformed"
[ -f "$OUT/json-schema/orders.schema.json" ] || fail "json schema missing"
node -e "const s = require('$OUT/json-schema/orders.schema.json'); if (s.additionalProperties !== false || !s.properties.total) process.exit(1)" || fail "json schema malformed"
[ -f "$OUT/fast-check/orders.mjs" ] || fail "fast-check arb missing"
(cd out-work && node -e "
Promise.all([import('$OUT/fast-check/orders.mjs'), import('$OUT/zod/orders.mjs'), import('fast-check')]).then(([a, z, f]) => {
  const fc = f.default;
  for (const row of fc.sample(a.ordersRow ?? a.ordersArb, 5)) {
    const v = z.ordersRow.safeParse(row);
    if (!v.success) { console.error('arb row rejected by zod:', v.error.issues[0]); process.exit(1); }
  }
  console.log('fast-check arbs satisfy zod live: 5/5');
})") || fail "fast-check arbs do not satisfy zod"

echo "== 9c. batch-2 target assertions =="
[ -f "$OUT/forms/orders.mjs" ] || fail "forms config missing"
node -e "import('$OUT/forms/orders.mjs').then((m) => { const f = m.ordersFields.find((x) => x.name === 'status'); if (!f || f.control !== 'select' || !f.options.includes('refunded')) process.exit(1); })" || fail "forms enum select malformed"
[ -f "$OUT/factories/orders.mjs" ] || fail "factory missing"
(cd out-work && node -e "
Promise.all([import('$OUT/factories/orders.mjs'), import('$OUT/zod/orders.mjs')]).then(([f, z]) => {
  const row = f.makeOrders({ refund_reason: 'damaged' });
  const v = z.ordersRow.safeParse(row);
  if (!v.success) { console.error('factory row rejected:', v.error.issues[0]); process.exit(1); }
  if (row.refund_reason !== 'damaged') process.exit(1);
  console.log('factory row satisfies zod live');
})") || fail "factory row does not satisfy zod"
[ -f "$OUT/trpc/orders.mjs" ] || fail "trpc router missing"
(cd out-work && node -e "
Promise.all([import('$OUT/trpc/orders.mjs'), import('@trpc/server'), import('postgres')]).then(async ([m, trpc, pg]) => {
  const sql = pg.default(process.env.DATABASE_URL, { max: 1 });
  const t = trpc.initTRPC.create();
  const router = m.createOrdersRouter(t, sql);
  const caller = t.createCallerFactory(router)({});
  const rows = await caller.list();
  if (!rows.length || typeof rows[0].total !== 'string') { console.error('trpc list wrong'); process.exit(1); }
  const one = await caller.byId({ id: rows[0].id });
  if (!one || one.id !== rows[0].id) { console.error('trpc byId wrong'); process.exit(1); }
  const created = await caller.create({ user_id: rows[0].user_id, status: 'paid', total: '5.00', tags: ['e2e'] });
  if (created.total !== '5.00') { console.error('trpc create wrong'); process.exit(1); }
  console.log('trpc live: list ' + rows.length + ', byId ok, create ok');
  await sql.end();
})") || fail "trpc router failed against live db"

echo "== 9d. batch-3 target assertions =="
[ -f "$OUT/schema-card.md" ] || fail "schema card missing"
awk 'index($0, "- orders") { f = 1 } END { exit !f }' "$OUT/schema-card.md" || fail "card lacks orders"
[ -f "$OUT/schema-dictionary.md" ] || fail "dictionary missing"
awk 'index($0, "Gross amount, tax included.") { f = 1 } END { exit !f }' "$OUT/schema-dictionary.md" || fail "live comment absent from dictionary"
[ -f "$OUT/realtime.types.ts" ] || fail "realtime types missing"
awk 'index($0, "OrdersChanges = RealtimePostgresChangesPayload<OrdersWireRow>") { f = 1 } END { exit !f }' "$OUT/realtime.types.ts" || fail "realtime alias missing"
awk 'index($0, "\"total\": number;") { f = 1 } END { exit !f }' "$OUT/realtime.types.ts" || fail "realtime wire profile wrong for numeric"
cat > out-work/realtime-check.ts <<RT
import type { OrdersChanges } from "./generated/realtime.types.js";
const handle = (c: OrdersChanges) => {
  if (c.eventType === "INSERT") {
    const total: number = c.new.total;
    void total;
  }
};
void handle;
RT
(cd out-work && npx tsc --noEmit --strict --skipLibCheck --target es2022 --module nodenext --moduleResolution nodenext realtime-check.ts) || fail "realtime types do not typecheck against supabase-js"

echo "== 9e. batch-4 target assertions =="
[ -f "$OUT/mcp-server.mjs" ] || fail "mcp server missing"
[ -f "$OUT/ai-tools.mjs" ] || fail "ai tools missing"
[ -f "$OUT/database.types.ts" ] || fail "bridge missing"
awk 'index($0, "order_total_sum: {") { f = 1 } END { exit !f }' "$OUT/database.types.ts" || fail "bridge Functions block missing"
(cd out-work && node -e "
Promise.all([import('$OUT/mcp-server.mjs'), import('@modelcontextprotocol/sdk/client/index.js'), import('@modelcontextprotocol/sdk/inMemory.js'), import('postgres')]).then(async ([m, c, t, pg]) => {
  const sql = pg.default(process.env.DATABASE_URL, { max: 1 });
  const server = m.createMcpServer({ sql });
  const [ct, st] = t.InMemoryTransport.createLinkedPair();
  const client = new c.Client({ name: 'e2e', version: '0.0.1' });
  await Promise.all([server.connect(st), client.connect(ct)]);
  const tools = await client.listTools();
  if (!tools.tools.some((x) => x.name === 'orders_list')) { console.error('no orders_list'); process.exit(1); }
  const res = await client.callTool({ name: 'orders_list', arguments: { limit: 5 } });
  const rows = JSON.parse(res.content[0].text);
  if (!rows.length || typeof rows[0].total !== 'string') { console.error('mcp rows wrong'); process.exit(1); }
  console.log('mcp live: ' + tools.tools.length + ' tools, orders_list ' + rows.length + ' rows');
  await client.close(); await server.close(); await sql.end();
})") || fail "mcp round trip failed"
(cd out-work && node -e "
Promise.all([import('$OUT/ai-tools.mjs'), import('postgres')]).then(async ([m, pg]) => {
  const sql = pg.default(process.env.DATABASE_URL, { max: 1 });
  const tools = m.createAiTools({ sql });
  const rows = await tools.orders_list.execute({ limit: 3 });
  if (!rows.length) { console.error('ai tools empty'); process.exit(1); }
  console.log('ai-tools live: orders_list ' + rows.length + ' rows');
  await sql.end();
})") || fail "ai tools execute failed"

echo "== 9f. seed target assertions =="
[ -f "$OUT/seed.sql" ] || fail "seed.sql missing"
awk 'index($0, "insert into \"public\".\"users\"") { f = 1 } END { exit !f }' "$OUT/seed.sql" || fail "seed lacks users inserts"
awk 'index($0, "setval") { f = 1 } END { exit !f }' "$OUT/seed.sql" || fail "seed lacks sequence resync"

echo "== 9g. final-wave target assertions =="
[ -f "$OUT/effect/orders.mjs" ] || fail "effect schema missing"
(cd out-work && node -e "
Promise.all([import('$OUT/effect/orders.mjs'), import('effect'), import('postgres')]).then(async ([m, e, pg]) => {
  const sql = pg.default(process.env.DATABASE_URL, { max: 1 });
  const rows = await sql.unsafe('select * from orders limit 5');
  const decode = e.Schema.decodeUnknownEither(m.ordersRow);
  for (const row of rows) {
    const r = decode(row);
    if (r._tag !== 'Right') { console.error('effect rejected a live row: ' + String(r.left).slice(0, 300)); process.exit(1); }
  }
  console.log('effect live: ' + rows.length + '/' + rows.length + ' rows decoded');
  await sql.end();
})") || fail "effect schema rejected live rows"
[ -f "$OUT/rest/orders.mjs" ] || fail "rest routes missing"
(cd out-work && node -e "
Promise.all([import('$OUT/rest/orders.mjs'), import('postgres')]).then(async ([m, pg]) => {
  const sql = pg.default(process.env.DATABASE_URL, { max: 1 });
  const app = m.createOrdersRoutes(sql);
  const list = await app.request('/');
  if (list.status !== 200) { console.error('list status ' + list.status); process.exit(1); }
  const rows = await list.json();
  if (!rows.length) { console.error('rest list empty'); process.exit(1); }
  const one = await app.request('/' + rows[0].id);
  if (one.status !== 200) { console.error('byId status ' + one.status); process.exit(1); }
  const bad = await app.request('/', { method: 'POST', body: JSON.stringify({ status: 'nope' }), headers: { 'content-type': 'application/json' } });
  if (bad.status !== 400) { console.error('invalid insert not rejected: ' + bad.status); process.exit(1); }
  const good = await app.request('/', { method: 'POST', body: JSON.stringify({ user_id: rows[0].user_id, status: 'paid', total: '7.50', tags: ['e2e-rest'] }), headers: { 'content-type': 'application/json' } });
  if (good.status !== 201) { console.error('valid insert failed: ' + good.status + ' ' + (await good.text())); process.exit(1); }
  console.log('rest live: list ' + rows.length + ', byId ok, 400 on invalid, 201 on create');
  await sql.end();
})") || fail "hono routes failed against live db"
[ -f "$OUT/service/orders.mjs" ] || fail "service repo missing"
(cd out-work && node -e "
Promise.all([import('$OUT/service/orders.mjs'), import('postgres')]).then(async ([m, pg]) => {
  const sql = pg.default(process.env.DATABASE_URL, { max: 1 });
  const repo = m.createOrdersRepo(sql);
  const rows = await repo.list({ limit: 5 });
  if (!rows.length) { console.error('service list empty'); process.exit(1); }
  const created = await repo.create({ user_id: rows[0].user_id, status: 'paid', total: '8.25', tags: ['e2e-svc'] });
  const updated = await repo.update(created.id, { total: '9.00' });
  if (updated.total !== '9.00') { console.error('update wrong: ' + updated.total); process.exit(1); }
  if (!(await repo.remove(created.id))) { console.error('remove failed'); process.exit(1); }
  if ((await repo.findById(created.id)) !== null) { console.error('row survived remove'); process.exit(1); }
  let rejected = false;
  await repo.create({ user_id: rows[0].user_id, status: 'bogus', total: 'x', tags: [] }).catch(() => { rejected = true; });
  if (!rejected) { console.error('invalid create accepted'); process.exit(1); }
  console.log('service live: list, create, update, remove, invalid rejected');
  await sql.end();
})") || fail "service repo failed against live db"
[ -f "$OUT/orpc/orders.mjs" ] || fail "orpc router missing"
(cd out-work && node -e "
Promise.all([import('$OUT/orpc/orders.mjs'), import('@orpc/server'), import('postgres')]).then(async ([m, o, pg]) => {
  const sql = pg.default(process.env.DATABASE_URL, { max: 1 });
  const router = m.createOrdersOrpc(sql);
  const rows = await o.call(router.list, undefined);
  if (!rows.length) { console.error('orpc list empty'); process.exit(1); }
  const one = await o.call(router.byId, { id: rows[0].id });
  if (!one || one.id !== rows[0].id) { console.error('orpc byId wrong'); process.exit(1); }
  let rejected = false;
  await o.call(router.create, { status: 'nope' }).catch(() => { rejected = true; });
  if (!rejected) { console.error('orpc accepted invalid create'); process.exit(1); }
  console.log('orpc live: list ' + rows.length + ', byId ok, invalid rejected');
  await sql.end();
})") || fail "orpc router failed against live db"
[ -f "$OUT/graphql-schema.mjs" ] || fail "graphql schema missing"
(cd out-work && node -e "
Promise.all([import('$OUT/graphql-schema.mjs'), import('graphql'), import('postgres')]).then(async ([m, g, pg]) => {
  const sql = pg.default(process.env.DATABASE_URL, { max: 1 });
  const schema = m.createGraphqlSchema(sql);
  const result = await g.graphql({ schema, source: '{ orders { id total status } }' });
  if (result.errors) { console.error('graphql errors: ' + result.errors[0]); process.exit(1); }
  const orders = result.data.orders;
  if (!orders.length || typeof orders[0].total !== 'string') { console.error('graphql rows wrong'); process.exit(1); }
  console.log('graphql live: orders ' + orders.length + ' rows');
  await sql.end();
})") || fail "graphql schema failed against live db"
[ -f "$OUT/structure.pgtap.sql" ] || fail "pgtap file missing"
awk "index(\$0, \"has_table('public', 'orders'\") { f = 1 } END { exit !f }" "$OUT/structure.pgtap.sql" || fail "pgtap lacks orders has_table"
awk "index(\$0, \"'rls enabled on public.orders'\") { f = 1 } END { exit !f }" "$OUT/structure.pgtap.sql" || fail "pgtap lacks live rls assertion"
awk 'index($0, "tests.") { bad = 1 } END { exit bad }' "$OUT/structure.pgtap.sql" || fail "pgtap emitted a non-portable tests.* helper"
awk "index(\$0, \"policies_are('public', 'orders', array['orders_read']\") { f = 1 } END { exit !f }" "$OUT/structure.pgtap.sql" || fail "pgtap lacks live policy assertion"
[ -f "$OUT/rls-skeletons.sql" ] || fail "rls skeletons missing"
awk 'index($0, "orders: rls enabled, 1 policies exist") { f = 1 } END { exit !f }' "$OUT/rls-skeletons.sql" || fail "covered table restubbed or missing"
awk 'index($0, "alter table \"public\".\"users\" enable row level security;") { f = 1 } END { exit !f }' "$OUT/rls-skeletons.sql" || fail "uncovered table not stubbed"
awk 'index($0, "TODO: no owner or tenant column detected") { f = 1 } END { exit !f }' "$OUT/rls-skeletons.sql" || fail "heuristic miss not surfaced honestly"
[ -f "$OUT/pgmq-clients.mjs" ] || fail "pgmq clients missing"
awk 'index($0, "export const queues = {};") { f = 1 } END { exit !f }' "$OUT/pgmq-clients.mjs" || fail "pgmq stub wrong without pgmq schema"

echo "== 10. check: clean tree passes, tampering fails =="
(cd out-work && "$CLI" check) || fail "check reported drift on a clean tree"
printf '// tampered\n' >> "$OUT/zod/orders.mjs"
if (cd out-work && "$CLI" check > ../check-drift.log 2>&1); then
  fail "check missed hand-edited drift"
fi
awk 'index($0, "drift (stale)") { f = 1 } END { exit !f }' check-drift.log || fail "check did not name the stale file"
(cd out-work && "$CLI" generate >/dev/null) || fail "generate could not repair drift"
(cd out-work && "$CLI" check) || fail "check still drifting after regenerate"

echo "== 10b. driver-truth settings: a corrupting database default must not corrupt supawatch =="
# Measured: with bytea_output=escape an 8 byte value decodes to 1 wrong
# byte, and with DateStyle=German a date comes back day/month swapped,
# both silently. A database can force either on every connection.
$PSQL -c "alter database e2e set bytea_output to 'escape'" >/dev/null
$PSQL -c "alter database e2e set datestyle to 'German, DMY'" >/dev/null
(cd out-work && "$CLI" generate >/dev/null 2>&1) || fail "generate broke under corrupting database defaults"
(cd out-work && node -e "
const pg = require('postgres');
// no connection settings: exactly what a plain consumer gets
const plain = pg(process.env.DATABASE_URL, { max: 1 });
const pinned = pg(process.env.DATABASE_URL, { max: 1, connection: { DateStyle: 'ISO, MDY', bytea_output: 'hex' } });
Promise.all([
  plain.unsafe(\"select '\\\\x89504e470d0a1a0a'::bytea as b, '2026-03-04'::date as d\"),
  pinned.unsafe(\"select '\\\\x89504e470d0a1a0a'::bytea as b, '2026-03-04'::date as d\"),
]).then(async ([[p], [q]]) => {
  const bad = p.b.length !== 8 || p.d.toISOString().slice(0, 10) !== '2026-03-04';
  const good = q.b.length === 8 && q.d.toISOString().slice(0, 10) === '2026-03-04';
  if (!bad) { console.error('control did not fire: unpinned read was already correct'); process.exit(1); }
  if (!good) { console.error('pinned connection still wrong: ' + q.b.length + ' bytes, ' + q.d.toISOString()); process.exit(1); }
  console.log('driver truth: unpinned ' + p.b.length + ' bytes/' + p.d.toISOString().slice(0, 10) + ', pinned ' + q.b.length + ' bytes/' + q.d.toISOString().slice(0, 10));
  await plain.end(); await pinned.end();
})") || fail "pinned settings did not restore driver truth"
(cd out-work && "$CLI" doctor > ../doctor-settings.log 2>&1) && fail "doctor passed while the database corrupts consumer connections"
awk 'index($0, "driver settings") && index($0, "bytea_output is escape") { f = 1 } END { exit !f }' doctor-settings.log \
  || fail "doctor did not name the corrupting settings"
$PSQL -c "alter database e2e reset bytea_output" >/dev/null
$PSQL -c "alter database e2e reset datestyle" >/dev/null
(cd out-work && "$CLI" doctor >/dev/null 2>&1) || fail "doctor still unhealthy after resetting the database defaults"

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
awk 'index($0, "\"total\": z.union([z.number()") { f = 1 } END { exit !f }' "$PROUT/zod/orders.mjs" || fail "profile zod schema still string for numeric"

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
