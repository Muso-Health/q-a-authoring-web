import type { Environment } from './environment.model';

// The production build, deployed to the `prod` Firebase site (`npm run deploy:prod`).
//
// FILL BEFORE DEPLOYING: the production Cloud Run engine's URL. Until then it is a `.invalid`
// placeholder, which can never resolve, and `scripts/deploy.sh` refuses to ship a build carrying
// one. The engine must list the site's origins (https://qa-authoring.web.app and
// https://qa-authoring.firebaseapp.com) in `QA_AUTHORING_CORS_ALLOWED_ORIGINS`.
//
// Still the dev identity: the Entra adapter is the next step.
export const ENVIRONMENT: Environment = {
  apiBaseUrl: 'https://prod-engine-url.replace-me.invalid',
  auth: { provider: 'dev', email: '' },
};
