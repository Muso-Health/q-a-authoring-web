import type { components } from './generated/schema';

/** The engine's schemas, generated from its OpenAPI contract (`npm run gen:api`). */
export type Schemas = components['schemas'];

export type HealthResponse = Schemas['HealthResponse'];
export type MeResponse = Schemas['MeResponse'];
