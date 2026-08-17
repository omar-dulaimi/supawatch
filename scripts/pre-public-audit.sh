#!/usr/bin/env bash
# Everything worth knowing before a private repo becomes public. History
# is what matters: deleting a file from HEAD does not remove it from the
# clone strangers will get.
set -uo pipefail
cd "$(dirname "$0")/.."

echo "== 1. secret-shaped strings anywhere in history =="
PATTERN='sb_secret_|sb_publishable_|pooler\.supabase\.com|SUPABASE_SERVICE_ROLE|service_role|BEGIN (RSA|OPENSSH|EC) PRIVATE KEY|npm_[A-Za-z0-9]{30}|ghp_[A-Za-z0-9]{30}'
hits=$(git grep -I -n -E "$PATTERN" $(git rev-list --all) -- 2>/dev/null | head -20)
if [ -z "$hits" ]; then
  echo "  none found across $(git rev-list --all | wc -l) commits"
else
  echo "$hits" | sed 's/^/  /'
fi

echo "== 2. .env or key files ever committed =="
envs=$(git log --all --diff-filter=A --name-only --pretty=format: \
  | sort -u | grep -E '(^|/)\.env|\.pem$|\.p12$|\.key$|id_rsa' | head -10)
[ -z "$envs" ] && echo "  none" || echo "$envs" | sed 's/^/  /'

echo "== 3. files removed from HEAD but still in history =="
removed=$(git log --all --diff-filter=D --name-only --pretty=format: \
  | sort -u | grep -v '^$' | head -8)
echo "$removed" | sed 's/^/  /' | head -8
count=$(git log --all --diff-filter=D --name-only --pretty=format: | sort -u | grep -c . || true)
echo "  ($count paths deleted at some point; all remain readable in history)"

echo "== 4. repository weight a stranger will clone =="
du -sh .git 2>/dev/null | sed 's/^/  /'

echo "== 5. community files a public repo is judged on =="
for f in LICENSE README.md CONTRIBUTING.md SECURITY.md CODE_OF_CONDUCT.md \
         .github/ISSUE_TEMPLATE .github/PULL_REQUEST_TEMPLATE.md; do
  [ -e "$f" ] && echo "  present: $f" || echo "  MISSING: $f"
done

echo "== 6. TODO/FIXME/XXX left in shipped source =="
todos=$(git grep -n -E "TODO|FIXME|XXX|HACK" -- 'packages/*/src/*.ts' 2>/dev/null | grep -v "TODO: confirm the tenant claim\|TODO: no owner\|_policy\" on\|TODO)" | head -6)
[ -z "$todos" ] && echo "  none outside deliberately emitted TODO stubs" || echo "$todos" | sed 's/^/  /'

echo "== 7. internal references that only make sense to us =="
refs=$(git grep -n -iE "supawatch-files|/home/user|claude|drzl" -- README.md 'packages/*/README.md' 'packages/*/src/*.ts' 2>/dev/null | head -6)
[ -z "$refs" ] && echo "  none in shipped files" || echo "$refs" | sed 's/^/  /'
