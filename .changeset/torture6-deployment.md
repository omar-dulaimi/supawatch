---
"supawatch": minor
"@supawatch/watch": minor
"@supawatch/target-schema-lock": patch
"@supawatch/target-erd": patch
"@supawatch/verify": patch
---

Torture round 6 went after determinism and deployment reality, and
found three defects including a severe regression from the previous
round.

supawatch could not connect through a connection pooler at all. Pinning
driver settings as startup parameters is rejected outright by PgBouncer
and Supavisor ("unsupported startup parameter: bytea_output"), which
broke Supabase's pooled port, the connection method their serverless
guidance recommends. Only pooler-safe parameters are sent now; the
settings that cannot be forced are reported as a warning instead, so a
corrupting environment is still named rather than silently trusted.

The watcher looked perfectly healthy while being permanently deaf. A
transaction-mode pooler accepts LISTEN and then never delivers, so
`supawatch watch` sat there logging "idle, listening" forever and never
saw a schema change. It now proves delivery on a separate self-test
channel at startup, resolving as soon as the ping lands, and warns with
the fix (a direct connection, or `source: { kind: "poll" }`) when
nothing arrives.

Committed files were ordered by locale. `schema.lock.json` and the ER
diagram sorted with `localeCompare` and no explicit locale, so ICU
decided: measured, `en-US` orders `A_b a-b ab ärger Zeta` while `sv-SE`
puts `ärger` last. Both files are committed and byte-compared, so two
developers with different `LANG`, or CI with a different ICU build,
would see drift on an identical schema. Both now sort by code point.

Verified clean in the same round: the generated ESM modules import on
Node 18, 20, 22 and 24; the `.d.mts` companions give real types under
`node10`, `node16`, `nodenext` and `bundler` resolution, each proven with
a wrong-shape control; and polling works through a transaction pooler,
the documented workaround for the LISTEN limitation.
