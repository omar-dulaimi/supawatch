# @supawatch/target-seed

## 0.7.0

### Patch Changes

- 9314a4a: Domains now carry `hasConstraints` in the snapshot: true when the
  domain, or any domain in its base chain, has a CHECK constraint or NOT
  NULL. The seed target uses it to stop guessing: a base-type placeholder
  for a constrained domain can violate its CHECK and make the whole
  seed.sql fail to apply (found by dogfooding). Constrained domain columns
  are now omitted when nullable or defaulted and skip their table with a
  named reason when required; unconstrained domains seed as their base
  type, unchanged. Skips also cascade: a table whose required foreign key
  references an unseeded table is skipped too, so the emitted file always
  applies. Committed schema.lock.json files gain the new domain field on
  first regenerate after upgrading; `supawatch generate` heals the
  one-time drift.
- Updated dependencies [9314a4a]
  - @supawatch/core@0.7.0

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
