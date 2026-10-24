import type { Environment } from './environment.model';

// `npm start`: the engine under uvicorn locally, run with `QA_AUTHORING_AUTH_PROVIDER=dev` and
// `QA_AUTHORING_CORS_ALLOWED_ORIGINS=http://localhost:4200`. The email must be a known, active
// user — e.g. the one in `QA_AUTHORING_BOOTSTRAP_ADMIN_EMAIL`.
export const ENVIRONMENT: Environment = {
  apiBaseUrl: 'http://localhost:8000',
  auth: { provider: 'dev', email: 'you@example.org' },
};
