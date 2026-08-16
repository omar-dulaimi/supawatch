---
"supawatch": minor
"@supawatch/core": minor
"@supawatch/target-effect": minor
"@supawatch/target-rest": minor
"@supawatch/target-service": minor
"@supawatch/target-orpc": minor
"@supawatch/target-graphql": minor
"@supawatch/target-pgtap": minor
"@supawatch/target-rls": minor
"@supawatch/target-pgmq": minor
"@supawatch/verify": minor
---

Eight new targets: effect (Effect Schema structs, verified as a fifth
parity verdict), rest (Hono route modules), service (typed repositories
over postgres.js), orpc (oRPC routers), graphql (an executable Pothos
schema), pgtap (a plan-counted structural test suite), rls (policy
skeletons for exactly the tables that need attention), and pgmq (typed
queue clients per detected queue).

Core grows an RLS facet: tables now carry `rlsEnabled` and their
`pg_policies` rows, and the watcher diff reports RLS enables, disables,
policy creates, and policy drops as they happen.
