# How schemas are verified

The rule the project is built on: a generated artifact is not working
until something has consumed it the way its consumer consumes it.

## Every run

Every `generate` and every watch cycle parses real rows from your
database with the schemas it just wrote. A schema nobody has run against
real data is not reported as success. You see the result inline:

```text
[supawatch] ground-truth check, tasks: 3/3 passed
```

## The repo's own harness

`@supawatch/verify` goes further than the per-run check:

- **A value pool over every mapped Postgres type**, so each mapping is
  exercised against values the database can really store, including the
  awkward ones (`NaN`, infinities, BC dates, empty arrays).
- **Synthetic negatives per column**, so a schema that accepts everything
  fails the suite instead of passing it.
- **Cross-target parity**, where every validator target must return the
  same accept or reject verdict for every case. Differences are allowed
  only as named, recorded exceptions, so a divergence that nobody
  decided on is a failure.

## Why the mappings are measured

Type mappings come from probing the driver, not from the SQL type chart.
`numeric` is a string because the driver returns a string, and floats
accept `NaN` because Postgres really stores it. If you change a mapping,
the contribution rule is to include how you measured it: the probe, the
driver, and the value you saw. See [CONTRIBUTING.md](../CONTRIBUTING.md).
