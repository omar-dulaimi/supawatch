---
"@supawatch/core": patch
"@supawatch/verify": patch
---

Two supawatch processes writing the same output directory could kill
each other. Every atomic write used a fixed `<file>.tmp`, so when a
watcher and a manual `generate` overlapped, one process renamed the
shared temp file away and the other's rename failed with `ENOENT`,
ending that run. Each write now uses a temp name unique to the process
and the write, so both finish, the last rename wins, and the target file
is never torn. A failed write also cleans up its own temp file.

Verified in the same round, with the previous behavior reproduced first:
concurrent generates now both exit 0, `check` never crashes while a
watcher regenerates, and generation survives DDL landing mid
introspection.
