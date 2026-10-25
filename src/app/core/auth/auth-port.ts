/**
 * Who the API should see the caller as. An abstract class, so it is both the contract and the
 * injection token. Adapters: `DevAuthAdapter` (X-Dev-User) locally, `EntraAuthAdapter` (an MSAL
 * bearer token) when deployed. The interceptor asks per call and never caches.
 */
export abstract class AuthPort {
  /** Headers proving the caller's identity right now; empty when there is none. */
  abstract authHeaders(): Promise<Readonly<Record<string, string>>>;

  /** The engine refused the caller (401): establish an identity again, if this provider can. */
  abstract reauthenticate(): Promise<void>;

  abstract signOut(): Promise<void>;
}
