# @supawatch/verify

The verification harness of
[supawatch](https://github.com/omar-dulaimi/supawatch). Runs every
registered target against a real embedded Postgres (PGlite) and compares
verdicts, not source text.

Primarily used by supawatch's own test suite; useful directly when building
a custom target.

```bash
npm install --save-dev @supawatch/verify
```

```ts
import { runHarness } from "@supawatch/verify";
import { ZodTarget } from "@supawatch/target-zod";

const result = await runHarness({
  targets: [{ target: new ZodTarget(), options: { strict: true } }],
  workDir: "/tmp/harness",
});
if (result.problems.length > 0) throw new Error(result.problems.join("\n"));
```

What a run checks:

- Ground truth: every real row from the fixture must be accepted by every
  target's emitted schema.
- Negatives: per-column wrong values (wrong kind, null in not-null, extra
  key, wrong array element) must be rejected.
- Parity: all targets must return the same verdict for every case.
- The ALLOWED ledger: a named divergence must keep firing; an entry that
  stops firing fails the run, so a fixed gap reports itself.
- Completeness: every row of core's runtime-type map must be exercised by
  the fixture, enforced, so an unverified mapping cannot ship.

MIT.
