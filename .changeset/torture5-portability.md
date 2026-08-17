---
"supawatch": minor
"@supawatch/watch": minor
"@supawatch/target-schema-lock": minor
"@supawatch/verify": patch
---

Torture round 5 went after portability, upgrades and long-lived
connections, and found three defects.

The watcher decoded values with stale type parsers. A driver learns its
custom type parsers when it CONNECTS, and the watcher holds one
connection for hours while migrations run, so an enum created after it
started decoded as the raw literal `{ok,bad}` from then on while the
schemas generated in the same cycle expected a real array: every later
verification of that table was wrong. The watcher now reconnects its
query connection when the catalog's custom types change, on a
connection separate from the LISTEN one so notifications keep flowing.

Generated file names could collide on a case insensitive filesystem.
Postgres holds `Users`, `users` and `USERS` as three tables; on macOS
and Windows their files are one file, so two schemas were silently
overwritten and the barrel exported modules that no longer existed,
while Linux CI stayed green. Generated files are committed and shared,
so this now fails loudly like the other collision guards.

Upgrading supawatch made `check` report schema drift that never
happened. The lockfile records facets added since it was designed
(table kind, RLS state, policies, domain constraints) but its format
version never moved, so a committed lockfile from an older version read
as stale generated output. The format is now 2, and `check` recognises a
format difference and says to regenerate instead of blaming the schema.

Verified clean in the same round: introspection, generation, seeds and
ground truth across Postgres 13, 14, 15, 16 and 17, and crash
resilience, where SIGKILL mid-regeneration left no truncated file and no
dangling barrel entry, `check` reported the mixed directory, and a
rerun healed it.
