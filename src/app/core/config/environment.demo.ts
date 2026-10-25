import type { Environment } from './environment.model';

// TEMPORARY — the `demo` build, deployed to the `demo` Firebase site (`npm run deploy:demo`), for
// the operator alone until Entra is live; delete it then, with its configuration, target, site and
// `scripts/deploy-demo.sh`. Swapped in for `environment.ts` by `angular.json`'s `demo`
// configuration.
//
// It signs in with the DEV adapter: every request says `X-Dev-User: <email>`, and anyone who can
// open the site is that user. Not for sharing.
//
// FILL BEFORE DEPLOYING (`scripts/deploy-demo.sh` refuses either placeholder):
// - apiBaseUrl: the demo Cloud Run engine's URL. That engine must run with
//   `QA_AUTHORING_AUTH_PROVIDER=dev` and list https://qa-authoring-demo.web.app and
//   https://qa-authoring-demo.firebaseapp.com in `QA_AUTHORING_CORS_ALLOWED_ORIGINS`.
// - email: a known, active user of that engine. Never commit the real one (public repo).
export const ENVIRONMENT: Environment = {
  apiBaseUrl: 'https://demo-engine-url.replace-me.invalid',
  auth: { provider: 'dev', email: '<DEMO_DEV_EMAIL>' },
};
