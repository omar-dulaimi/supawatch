# Supabase

supawatch is built Supabase-first and works on any Postgres.

The event trigger works on Supabase because the supautils extension lets
the `postgres` role create event triggers without superuser. Verified
against a real hosted project on the free plan: `create event trigger`
succeeds as that non-superuser role, generation validates live rows over
TLS, and RLS state and policies introspect correctly.

Keep Supabase-managed schemas (`auth`, `storage`) out of `schemas` unless
you deliberately want them.

## Which connection string

Supabase offers three, and the choice decides whether `watch` can work.

| Connection | Port | Use it for |
| --- | --- | --- |
| Direct | 5432 | Everything, but it is IPv6 only unless you buy the IPv4 add-on. |
| Session pooler | 5432 | `watch`. Measured on a hosted project: it carries LISTEN. |
| Transaction pooler | 6543 | `generate` and `check`. It does NOT carry LISTEN. |

Transaction pooling drops session state, so a watcher there would accept
LISTEN and then never receive anything. supawatch proves delivery at
startup and warns when notifications do not arrive, rather than sitting
there looking healthy, and `supawatch doctor` reports the same failure.

Use the session pooler or a direct connection for `watch`, or set
`source: { kind: "poll" }`, which is measured to work through the
transaction pooler.

## What was verified end to end

The `supabase-js` profile is verified against a real hosted project:
PostgREST reads, writes through the generated insert schemas, embedded
selects across foreign keys, typed `rpc()` calls, and a live Realtime
payload validated against the generated wire types.
