# Driver profiles

Generated schemas describe what your code actually receives at runtime,
not what the SQL type chart suggests. Which runtime that is depends on the
driver, so the mapping is a measured profile rather than a fixed table.

## `postgres-js` (default)

The tagged-template driver.

| Postgres type | Arrives as |
| --- | --- |
| `numeric` | string |
| `int8` | string |
| `timestamptz`, `date` | `Date` |
| `bytea` | `Uint8Array` |

## `supabase-js`

PostgREST's JSON, for apps reading through `@supabase/supabase-js`.

| Postgres type | Arrives as |
| --- | --- |
| `numeric` | JSON number |
| `int8` | JSON number |
| `timestamptz`, `date` | string |
| `bytea` | hex string |
| enum arrays | real arrays |

> [!WARNING]
> Under the `supabase-js` profile, `int8` loses precision past 2^53. This
> was measured, not assumed: the probe watched `9007199254740993` arrive
> as `9007199254740992` over PostgREST.

## The supabase-types target

`supabase-types` emits a `Database` interface compatible with
`createClient<Database>` generics, including `Relationships` built from
real foreign-key introspection. It is always typed under the PostgREST
profile, whatever `profile` is set to, because that is the runtime the
generated types describe.
