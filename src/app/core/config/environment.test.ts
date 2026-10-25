import type { Environment } from './environment.model';

// The `test` build, deployed to the `test` Firebase site (`npm run deploy:test`): swapped in for
// `environment.ts` by `angular.json`'s `test` configuration, so the test site calls the test
// engine and never the production one.
//
// FILL BEFORE DEPLOYING: the test Cloud Run engine's URL; `scripts/deploy.sh` refuses the
// `.invalid` placeholder. The engine must list https://qa-authoring-test.web.app and
// https://qa-authoring-test.firebaseapp.com in `QA_AUTHORING_CORS_ALLOWED_ORIGINS`.
//
// Signed in with Microsoft Entra; the site's origin must be a registered SPA redirect URI.
export const ENVIRONMENT: Environment = {
  apiBaseUrl: 'https://test-engine-url.replace-me.invalid',
  auth: {
    provider: 'entra',
    // FILL from the Entra app registrations (public values — an SPA uses PKCE, no secret):
    tenantId: '<ENTRA_TENANT_ID>',
    clientId: '<ENTRA_SPA_CLIENT_ID>',
    // The engine API's delegated scope, e.g. `api://<engine-app-id>/access_as_user`. The token's
    // `aud` is that API, and the engine accepts only QA_AUTHORING_AUTH_ENTRA_AUDIENCE: the two
    // must name the same API (and its tenant must be QA_AUTHORING_AUTH_ENTRA_TENANT).
    engineScope: '<ENGINE_API_SCOPE>',
    redirectUri: '/',
  },
};
