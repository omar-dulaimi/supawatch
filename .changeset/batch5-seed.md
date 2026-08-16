---
"supawatch": minor
"@supawatch/target-seed": minor
---

The seed target: deterministic, FK-aware seed.sql. Topologically ordered
inserts, explicit identity ids via OVERRIDING SYSTEM VALUE, sequence
resync with setval, real enum labels, byte-stable output, and honest
skip comments for cycles, multi-column foreign keys, and unliteralable
required columns. Proven against a real empty database, with seeded rows
ground-truth checked by the generated Zod schemas.
