# @supawatch/target-factories

## 0.4.0

### Patch Changes

- Updated dependencies [21630d2]
- Updated dependencies [bbdd431]
  - @supawatch/core@0.4.0

## 0.3.0

### Minor Changes

- 78abb11: Three application-facing targets. forms emits framework-agnostic field
  configs per table (controls, labels, requiredness, enum options) derived
  from insert semantics. factories emits typed deterministic fixture
  factories whose default rows are guaranteed to satisfy the generated Zod
  schemas. trpc emits router factories with list, byId and create
  procedures wired to the generated Zod schemas and a postgres.js
  connection, proven in the e2e by a live createCaller round trip.

### Patch Changes

- @supawatch/core@0.3.0
