/**
 * Who the API should see the caller as. An abstract class, so it is both the contract and the
 * injection token. Adapters: `DevAuthAdapter` (X-Dev-User) now; an Entra/MSAL adapter answering
 * with a bearer token later, behind the same port. The interceptor asks per call and never caches.
 */
export abstract class AuthPort {
  /** Headers proving the caller's identity right now; empty when there is none. */
  abstract authHeaders(): Promise<Readonly<Record<string, string>>>;
}
