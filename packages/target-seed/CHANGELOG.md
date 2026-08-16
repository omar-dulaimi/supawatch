# @supawatch/target-seed

## 0.6.0

### Patch Changes

- Updated dependencies [0fbe207]
  - @supawatch/core@0.6.0

## 0.5.0

### Minor Changes

- e508d5f: The seed target: deterministic, FK-aware seed.sql. Topologically ordered
  inserts, explicit identity ids via OVERRIDING SYSTEM VALUE, sequence
  resync with setval, real enum labels, byte-stable output, and honest
  skip comments for cycles, multi-column foreign keys, and unliteralable
  required columns. Proven against a real empty database, with seeded rows
  ground-truth checked by the generated Zod schemas.

### Patch Changes

- @supawatch/core@0.5.0
