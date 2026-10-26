import type { Environment } from './environment.model';

// The `test` build, deployed to the `test` Firebase site (`npm run deploy:test`, or CI on a push
// to `develop`): swapped in for `environment.ts` by `angular.json`'s `test` configuration, so the
// test site calls the test engine and never the production one.
//
// Every value here is a public identifier, not a secret: the engine's URL, and the Entra
// registration an SPA names in the open (it uses PKCE, no client secret).
//
// The test engine must list https://qa-authoring-test.web.app and
// https://qa-authoring-test.firebaseapp.com in `QA_AUTHORING_CORS_ALLOWED_ORIGINS`, and the site's
// origin must be a registered SPA redirect URI of the client below.
export const ENVIRONMENT: Environment = {
  apiBaseUrl: 'https://qa-authoring-engine-test-uh7dztocmq-uc.a.run.app',
  auth: {
    provider: 'entra',
    tenantId: '54f70170-aa34-45ae-8315-0fa0d17d916e',
    clientId: '03dff017-5bbf-49b1-9f74-d22d217e36b8',
    // The engine API's delegated scope. The token's `aud` is that API, and the engine accepts
    // only QA_AUTHORING_AUTH_ENTRA_AUDIENCE: the two must name the same API (and its tenant must
    // be QA_AUTHORING_AUTH_ENTRA_TENANT).
    engineScope: 'api://9cc072fd-584f-4753-be07-539953fa21a0/access_as_user',
    redirectUri: '/',
  },
};
