/** How API calls are authenticated: the dev header locally, Microsoft Entra when deployed. */
export interface DevAuthConfig {
  readonly provider: 'dev';
  /** Sent as `X-Dev-User`; the engine's `dev` identity provider trusts it as-is. */
  readonly email: string;
}

/**
 * What Entra needs to identify this SPA and the engine it calls. Public values (an SPA uses PKCE
 * and holds no secret), but the repository still ships only `<…>` placeholders: an adapter given
 * one builds no MSAL client at all.
 */
export interface EntraAuthConfig {
  readonly provider: 'entra';
  /** The directory (tenant) id; the authority is `https://login.microsoftonline.com/<tenantId>`. */
  readonly tenantId: string;
  /** The SPA's own app registration (application) id. */
  readonly clientId: string;
  /**
   * The delegated scope the engine's API registration exposes, e.g.
   * `api://<engine-app-id>/access_as_user`. The token MSAL returns for it carries that API as its
   * `aud`, and the engine rejects any other: this must name the API whose audience is the
   * engine's `QA_AUTHORING_AUTH_ENTRA_AUDIENCE`.
   */
  readonly engineScope: string;
  /** Where Entra sends the browser back to — a registered SPA redirect URI. */
  readonly redirectUri: string;
}

export type AuthConfig = DevAuthConfig | EntraAuthConfig;

export interface Environment {
  /** The engine's origin (and optional path), without a trailing slash. */
  readonly apiBaseUrl: string;
  readonly auth: AuthConfig;
}
