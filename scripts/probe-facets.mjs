// Evidence probe: what does the driver hand JavaScript for composite,
// domain, and view columns? Run before mapping anything.
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
await db.exec(`
  create type money_amount as (currency text, cents int4);
  create domain email as text check (value like '%@%');
  create domain positive_cents as int4 check (value > 0);
  create table accounts (
    id serial primary key,
    contact email not null,
    balance money_amount not null,
    fee positive_cents not null
  );
  insert into accounts (contact, balance, fee)
    values ('a@b.c', row('EUR', 950)::money_amount, 30);
  create view rich_accounts as
    select id, contact, fee from accounts where fee > 10;
`);

const rows = (await db.query("select * from accounts")).rows;
for (const [k, v] of Object.entries(rows[0])) {
  console.log(`accounts.${k}: typeof=${typeof v} value=${JSON.stringify(v)}`);
}
const viewRows = (await db.query("select * from rich_accounts")).rows;
for (const [k, v] of Object.entries(viewRows[0])) {
  console.log(`rich_accounts.${k}: typeof=${typeof v} value=${JSON.stringify(v)}`);
}

const attrs = (
  await db.query(`
    select c.relname, c.relkind::text as relkind, a.attname,
           t.typname, t.typtype::text as typtype,
           bt.typname as base_typname,
           not a.attnotnull as is_nullable
    from pg_class c
    join pg_attribute a on a.attrelid = c.oid
    join pg_type t on t.oid = a.atttypid
    left join pg_type bt on bt.oid = t.typbasetype
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','v')
      and a.attnum > 0 and not a.attisdropped
    order by c.relname, a.attnum
  `)
).rows;
for (const r of attrs) {
  console.log(
    `${r.relkind} ${r.relname}.${r.attname}: typ=${r.typname} typtype=${r.typtype} base=${r.base_typname} nullable=${r.is_nullable}`,
  );
}
await db.close();
