import type { Environment } from './environment.model';

// The `test` build, deployed to the `test` Firebase site (`npm run deploy:test`): swapped in for
// `environment.ts` by `angular.json`'s `test` configuration, so the test site calls the test
// engine and never the production one.
//
// FILL BEFORE DEPLOYING: the test Cloud Run engine's URL; `scripts/deploy.sh` refuses the
// `.invalid` placeholder. The engine must list https://qa-authoring-test.web.app and
// https://qa-authoring-test.firebaseapp.com in `QA_AUTHORING_CORS_ALLOWED_ORIGINS`.
export const ENVIRONMENT: Environment = {
  apiBaseUrl: 'https://test-engine-url.replace-me.invalid',
  auth: { provider: 'dev', email: '' },
};
