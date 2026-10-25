#!/usr/bin/env bash
# TEMPORARY: build and deploy the dev-auth demo to its own Firebase Hosting site.
#
#   npm run deploy:demo  ->  the `demo` build (demo engine, dev auth)  ->  hosting:demo (qa-authoring-demo)
#
# For the operator alone until Entra is live, then deleted with the `demo` configuration, target,
# site and `environment.demo.ts`. The same steps as `scripts/deploy.sh`, which is left untouched so
# that removing the demo never means editing the test/prod path.
#
# Options:
#   --dry-run  test and build, then print the deploy command instead of running it
set -euo pipefail

usage() {
  echo "Usage: scripts/deploy-demo.sh [--dry-run]" >&2
  exit 2
}

dry_run=false
for option in "$@"; do
  case $option in
    --dry-run) dry_run=true ;;
    *) usage ;;
  esac
done

target=demo
configuration=demo
environment=environment.demo.ts
project=q-a-authoring
output=dist/qa-authoring-web/browser
cd "$(dirname "$0")/.."

revision=$(git rev-parse --short HEAD)
if [ -n "$(git status --porcelain)" ]; then
  revision="$revision-dirty"
fi

# THE GATE: nothing below runs unless this commit's tests pass.
npx ng test --watch=false

npm run build -- --configuration "$configuration"

# Until the demo engine's URL and the dev user's email are filled in, the build would call nothing
# or claim to be nobody; refuse it rather than publish it.
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
if grep -rqF '<DEMO_DEV_EMAIL>' "$output"; then
  refuse "The $configuration build still holds the dev-email placeholder: fill auth.email in src/app/core/config/$environment."
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
