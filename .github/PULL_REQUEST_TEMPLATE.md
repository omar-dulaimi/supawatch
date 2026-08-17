## What changes

<!-- From a user's point of view: what will they notice? -->

## How it was measured

<!--
Not "added a test" but what you actually observed. If a mapping changed,
the driver and the value you saw. If a target changed, the artifact you
ran and what it did. If a bug is fixed, how you reproduced it first.
-->

## Checklist

- [ ] `pnpm run gate` passes (unit tests and the Docker e2e)
- [ ] A test would fail without this change; I confirmed it fails
- [ ] A changeset describes the change for users (`pnpm changeset`)
- [ ] No em dashes or en dashes in prose (CI enforces this)
