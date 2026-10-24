import type { Environment } from './environment.model';

// Production build. Placeholders until the engine is deployed and the Entra adapter lands:
// `.invalid` can never resolve, so a premature deploy fails loudly instead of calling a stranger.
export const ENVIRONMENT: Environment = {
  apiBaseUrl: 'https://qa-authoring-engine.invalid',
  auth: { provider: 'dev', email: '' },
};
