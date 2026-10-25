import type { Environment } from './environment.model';

// The production build, deployed to the `prod` Firebase site (`npm run deploy:prod`).
//
// FILL BEFORE DEPLOYING: the production Cloud Run engine's URL. Until then it is a `.invalid`
// placeholder, which can never resolve, and `scripts/deploy.sh` refuses to ship a build carrying
// one. The engine must list the site's origins (https://qa-authoring.web.app and
// https://qa-authoring.firebaseapp.com) in `QA_AUTHORING_CORS_ALLOWED_ORIGINS`.
//
// Signed in with Microsoft Entra; the site's origin must be a registered SPA redirect URI.
export const ENVIRONMENT: Environment = {
  apiBaseUrl: 'https://prod-engine-url.replace-me.invalid',
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
