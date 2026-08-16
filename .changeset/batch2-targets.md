---
"supawatch": minor
"@supawatch/target-forms": minor
"@supawatch/target-factories": minor
"@supawatch/target-trpc": minor
---

Three application-facing targets. forms emits framework-agnostic field
configs per table (controls, labels, requiredness, enum options) derived
from insert semantics. factories emits typed deterministic fixture
factories whose default rows are guaranteed to satisfy the generated Zod
schemas. trpc emits router factories with list, byId and create
procedures wired to the generated Zod schemas and a postgres.js
connection, proven in the e2e by a live createCaller round trip.
