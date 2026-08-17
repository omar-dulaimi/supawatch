# Honest limits

Things supawatch deliberately does not claim. Each of these is a measured
constraint, not an unfinished feature.

## Shapes the catalog cannot know

- **JSON column shapes are `unknown`.** The catalog cannot verify a shape
  the database does not enforce. `jsonTypes` tightens the declared
  TypeScript type only; runtime validation stays `unknown` on purpose.
- **View columns are all nullable**, because Postgres reports them that
  way regardless of the underlying column. The table's `kind: "view"`
  marker in the IR says why.
- **Declared array dimensionality is not enforced by Postgres**, so a
  column declared multidimensional maps to an array of `unknown`.

## Values that are real, so they are accepted

- **Composite-type columns are strings.** Both drivers return the raw row
  literal like `"(EUR,950)"`, so an object schema would fail against real
  rows.
- **Floats can really hold `NaN` and the infinities**, and temporal
  columns can hold `infinity` or BC values, which arrive as those JS
  numbers and as `Date` instances with an invalid time. Generated schemas
  accept them, because rejecting real rows would be lying.

## Runtime constraints

- **Enum arrays are real arrays under both profiles**, with one measured
  caveat: postgres.js fetches custom type parsers when it connects, so a
  connection opened before the enum type existed returns the raw literal
  `"{a,b}"` until it reconnects. `supawatch generate` always uses a fresh
  connection.
- **The watcher's LISTEN connection needs a direct or session-mode
  connection.** Transaction-mode poolers (Supavisor port 6543, PgBouncer
  transaction mode) do not carry LISTEN. Use `source: { kind: "poll" }`
  where no such connection exists. See [supabase.md](supabase.md).

## Scope

supawatch does not run migrations, build queries, or replace your ORM. It
only reads your schema and writes schema files.
