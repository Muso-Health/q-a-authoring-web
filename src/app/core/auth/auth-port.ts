import type { Signal } from '@angular/core';

/**
 * Who the API should see the caller as. An abstract class, so it is both the contract and the
 * injection token. Adapters: `DevAuthAdapter` (X-Dev-User) locally, `EntraAuthAdapter` (an MSAL
 * bearer token) when deployed. The interceptor asks per call and never caches.
 */
export abstract class AuthPort {
  /**
   * The signed-in user's photograph, as a URL the app may render, or null — the ordinary case:
   * none set, no consent, offline, or a provider with no photos at all (dev). It is on the
   * contract so that Microsoft Graph is not: the header asks for a picture and never learns how
   * one was found. It may fill in late, so whoever shows it must look complete without it.
   */
  abstract readonly photo: Signal<string | null>;

  /** Headers proving the caller's identity right now; empty when there is none. */
  abstract authHeaders(): Promise<Readonly<Record<string, string>>>;

  /** The engine refused the caller (401): establish an identity again, if this provider can. */
  abstract reauthenticate(): Promise<void>;

  abstract signOut(): Promise<void>;
}
