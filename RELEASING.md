# Releasing supawatch

Versioning is changesets-driven (`.changeset/config.json`, all packages
versioned together as one fixed group). The release workflow runs the full
gate inside the release job because a changesets "Version Packages" PR
triggers no CI of its own.

## One-time manual steps (account owner)

These cannot be automated: npm org creation and a brand-new package's first
publish both require your npm login, and OIDC trusted publishing refuses
packages that do not exist yet.

1. Register the org: https://www.npmjs.com/org/create with the name
   `supawatch`. This reserves the `@supawatch` scope.

2. First publish, by hand, in dependency order, from a clean checkout with
   the gate green (`pnpm run gate`):

   ```
   pnpm run build
   for pkg in core target-zod target-valibot target-arktype target-typebox target-supabase-types watch verify cli; do
     (cd packages/$pkg && pnpm publish --access public --no-git-checks)
   done
   ```

   The cli package publishes the bare `supawatch` name and claims it.

3. On npmjs.com, for EVERY package just published, add a Trusted Publisher:
   repository `omar-dulaimi/supawatch`, workflow `release.yml`. From then on
   the release workflow publishes without tokens.

## Ongoing releases

1. Land changes on main with a changeset (`pnpm changeset`).
2. The release workflow opens or updates the "release: version packages" PR.
3. Merge that PR **with a merge commit, never a squash**. A squashed release
   PR keeps github-actions as the author, no workflow fires, and nothing
   publishes. If that happens anyway, recover with a manual
   `workflow_dispatch` of release.yml.
4. The same workflow run then gates (unit + e2e) and publishes.

## Known traps, already paid for elsewhere

- The "Version Packages" PR runs no CI: the GITHUB_TOKEN recursion guard.
  That is why the gate is a step inside the release job.
- Adding a brand-new package as a hard dependency of an already-published
  package IN THE SAME RELEASE breaks installs for everyone until the new
  package exists on the registry. Introduce new packages as
  optionalDependencies first, or publish them manually before the release
  that depends on them.
