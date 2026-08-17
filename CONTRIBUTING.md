# Contributing

Thanks for looking. This project has one unusual rule that shapes
everything else: **a claim is not true until something measured it.**

## The rule

Generated output is only "working" once it has been consumed the way its
consumer consumes it. A schema is proven by parsing real rows from a
real database, a diagram by rendering it, a SQL suite by executing it, a
server by connecting a client to it. Assertions that a file exists, or
that it parses, have repeatedly passed while the artifact was broken.

Every check needs a control that can fail. If you add a test, make it
fail on purpose once and keep that proof in the test, either as an
explicit negative case or as a comment recording what you saw.

## Running things

```bash
pnpm install
pnpm run test    # builds, then unit tests on PGlite; no Docker needed
pnpm run e2e     # Docker Postgres, pack-install-run consumer, live DDL
pnpm run gate    # both
```

The e2e installs packed tarballs into a throwaway consumer project
rather than linking the workspace, because the gap between a green
working tree and a published tarball is where the worst defects live.

## Adding a target

A target implements the seam in `@supawatch/core`: `renderTable` for
per-table output, or `renderSnapshot` for whole-file output, plus an
optional `verifier()` so generated artifacts can be checked against real
rows. Register it in `packages/cli/src/registry.ts` and add its kind to
`TARGET_KINDS`; a test asserts those two stay in lockstep.

New targets need their own package, a focused README, and at least one
test that runs the emitted artifact for real.

## Type mapping

Runtime types come from measurement, not from the SQL type chart. If you
change a mapping, include how you measured it: the probe, the driver,
the value you saw. `numeric` is a string because the driver returns a
string, and floats accept `NaN` because Postgres really stores it.

## Pull requests

Run `pnpm run gate` before opening one, and add a changeset
(`pnpm changeset`) describing the change from a user's point of view.
Releases are automated from changesets.

Prose in this repo avoids em dashes and en dashes; a CI step enforces it.
