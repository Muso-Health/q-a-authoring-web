#!/usr/bin/env bash
# Build and deploy the front end to one of its two Firebase Hosting sites.
#
#   npm run deploy:test   ->  the `test` build (test engine)        ->  hosting:test (qa-authoring-test)
#   npm run deploy:prod   ->  the `production` build (prod engine)  ->  hosting:prod (qa-authoring)
#
# The same steps as budgetisation-angular's deploy workflow, run from a workstation: test, choose
# the target, build, deploy. Hosting lives in the `q-a-authoring` project (`.firebaserc`); the
# engine stays in its own project and is reached by URL and CORS only.
#
# The target is chosen BEFORE the build because the engine is fixed at build time: there is no
# runtime switch to flip afterwards. Needs `firebase login` with access to `q-a-authoring`.
#
# Options:
#   --dry-run  test and build, then print the deploy command instead of running it
#   --yes      skip the confirmation asked before a prod deploy
set -euo pipefail

usage() {
  echo "Usage: scripts/deploy.sh <test|prod> [--dry-run] [--yes]" >&2
  exit 2
}

[ $# -ge 1 ] || usage
target=$1
shift
dry_run=false
assume_yes=false
for option in "$@"; do
  case $option in
    --dry-run) dry_run=true ;;
    --yes) assume_yes=true ;;
    *) usage ;;
  esac
done

case $target in
  test) configuration=test environment=environment.test.ts ;;
  prod) configuration=production environment=environment.ts ;;
  *) usage ;;
esac

project=q-a-authoring
output=dist/qa-authoring-web/browser
cd "$(dirname "$0")/.."

# A deploy is labelled with the commit it ships, and says so when that is not the whole story.
revision=$(git rev-parse --short HEAD)
if [ -n "$(git status --porcelain)" ]; then
  revision="$revision-dirty"
fi

if [ "$target" = prod ] && ! $dry_run && ! $assume_yes; then
  read -r -p "Deploy $revision to PRODUCTION (hosting:prod in $project)? [y/N] " answer
  [ "$answer" = y ] || [ "$answer" = Y ] || { echo "Cancelled." >&2; exit 1; }
fi

# THE GATE: nothing below runs unless this commit's tests pass.
npx ng test --watch=false

npm run build -- --configuration "$configuration"

# The environment files ship placeholders until the real values are filled in: the engine URL
# (`.replace-me.invalid`) and the Entra registration (`<ENTRA_TENANT_ID>` and friends). A build
# still carrying either would call nothing or sign nobody in; refuse it rather than publish it.
refuse() {
  if $dry_run; then
    echo "WARNING (a real deploy would stop here): $1" >&2
  else
    echo "ERROR: $1" >&2
    exit 1
  fi
}
if grep -rqF 'replace-me.invalid' "$output"; then
  refuse "The $configuration build still calls a placeholder engine: fill apiBaseUrl in src/app/core/config/$environment."
fi
if grep -rqF '<ENTRA_TENANT_ID>' "$output"; then
  refuse "The $configuration build still holds Entra placeholders: fill auth in src/app/core/config/$environment."
fi

deploy=(npx --yes firebase-tools@15 deploy --only "hosting:$target" --project "$project"
  --non-interactive --message "$revision")
if $dry_run; then
  printf 'Would run:'
  printf ' %q' "${deploy[@]}"
  printf '\n'
else
  "${deploy[@]}"
fi
