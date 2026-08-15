// Evidence probe for wave 2: what do PGlite AND postgres.js return for
// date, time, timetz, interval, bytea, inet, cidr, macaddr, and arrays?
// Usage:
//   node scripts/probe-scalars.mjs pglite
//   DATABASE_URL=... node scripts/probe-scalars.mjs postgres
const MODE = process.argv[2] ?? "pglite";

const DDL = `
  create type probe_state as enum ('a', 'b');
  create table probe (
    d date not null default '2026-02-03',
    t time not null default '13:45:10',
    ttz timetz not null default '13:45:10+02',
    iv interval not null default '1 day 02:00:00',
    by bytea not null default '\\xdeadbeef',
    ip inet not null default '192.168.0.1',
    net cidr not null default '10.0.0.0/8',
    mac macaddr not null default '08:00:2b:01:02:03',
    tags text[] not null default array['x','y'],
    counts int4[] not null default array[1,2,3],
    prices numeric[] not null default array['1.50','2.25']::numeric[],
    states probe_state[] not null default array['a','b']::probe_state[],
    refs uuid[] not null default array['00000000-0000-0000-0000-000000000001']::uuid[],
    deep int4[][] not null default array[array[1,2],array[3,4]]
  );
  insert into probe default values;
`;

function report(row) {
  for (const [k, v] of Object.entries(row)) {
    const t = Array.isArray(v)
      ? `array<${typeof v[0]}${Array.isArray(v[0]) ? ":nested" : ""}>`
      : v instanceof Date
        ? "Date"
        : Buffer.isBuffer(v)
          ? "Buffer"
          : v instanceof Uint8Array
            ? "Uint8Array"
            : typeof v;
    console.log(`${k}: ${t} = ${JSON.stringify(v)}`);
  }
}

if (MODE === "pglite") {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite();
  await db.exec(DDL);
  report((await db.query("select * from probe")).rows[0]);
  await db.close();
} else {
  const postgres = (await import("postgres")).default;
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  await sql.unsafe("drop table if exists probe; drop type if exists probe_state;");
  await sql.unsafe(DDL);
  report((await sql.unsafe("select * from probe"))[0]);
  await sql.unsafe("drop table probe; drop type probe_state;");
  await sql.end();
}
