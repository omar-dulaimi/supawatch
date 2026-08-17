---
"@supawatch/target-erd": minor
"supawatch": patch
"@supawatch/verify": patch
---

Two ERD defects found by rendering diagrams to images instead of
trusting that they parse.

Relationship edges were dropped entirely: an entity-trimming guard keyed
its lookups differently from the set it consulted, so every edge failed
the check and the diagram rendered as boxes with no relationships, while
parsing, size and alias assertions all still passed. One shared key
function now serves every relation lookup, and the suite asserts the
emitted edge count equals the schema's foreign-key count.

Layout is now legible on large schemas: Mermaid lays entities that have
no relationships out in a single endless row, so 40 entities rendered
10000 pixels wide with an empty middle, and 356 rendered 102000 pixels
wide. Past `maxIsolated` (default 10) those tables are omitted and
counted in a note, and past `maxEntities` (default 60) the least
connected go too, always keeping every edge between what remains. Both
caps accept 0 to disable.
