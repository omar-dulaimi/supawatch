# @supawatch/target-pgtap

## 0.7.1

### Patch Changes

- d0f303b: Two fixes found by inspecting real generated output. The pgtap suite
  asserted RLS through `tests.rls_enabled`, a Supabase test-helpers
  function that does not exist in core pgtap, contradicting the file's own
  "run with pg_prove" claim; it now asserts straight off `pg_class` with
  core `ok()`, so the suite runs under plain pg_prove and supabase test db
  alike. The schema card labeled every temporal column `date` because both
  `date` and `timestamptz` arrive as JS Date at runtime; an LLM reading
  "date" plans calendar arithmetic, so temporal columns now keep their SQL
  granularity (`date`, `timestamp`, `timestamptz`).
  - @supawatch/core@0.7.1

## 0.7.0

### Patch Changes

- Updated dependencies [9314a4a]
  - @supawatch/core@0.7.0

## 0.6.0

### Minor Changes

- 0fbe207: Eight new targets: effect (Effect Schema structs, verified as a fifth
  parity verdict), rest (Hono route modules), service (typed repositories
  over postgres.js), orpc (oRPC routers), graphql (an executable Pothos
  schema), pgtap (a plan-counted structural test suite), rls (policy
  skeletons for exactly the tables that need attention), and pgmq (typed
  queue clients per detected queue).

  Core grows an RLS facet: tables now carry `rlsEnabled` and their
  `pg_policies` rows, and the watcher diff reports RLS enables, disables,
  policy creates, and policy drops as they happen.

### Patch Changes

- Updated dependencies [0fbe207]
  - @supawatch/core@0.6.0
