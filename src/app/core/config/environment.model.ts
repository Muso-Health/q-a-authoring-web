/** How API calls are authenticated. An `entra` variant joins this union with the MSAL adapter. */
export interface DevAuthConfig {
  readonly provider: 'dev';
  /** Sent as `X-Dev-User`; the engine's `dev` identity provider trusts it as-is. */
  readonly email: string;
}

export type AuthConfig = DevAuthConfig;

export interface Environment {
  /** The engine's origin (and optional path), without a trailing slash. */
  readonly apiBaseUrl: string;
  readonly auth: AuthConfig;
}
