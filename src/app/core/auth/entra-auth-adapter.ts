import { DOCUMENT, InjectionToken, Service, inject, signal } from '@angular/core';
import type { Configuration, IPublicClientApplication } from '@azure/msal-browser';
import type { EntraAuthConfig } from '../config/environment.model';
import { AuthPort } from './auth-port';

/**
 * MSAL, imported for its TYPES only above and for real at first use below: the dynamic import
 * keeps the authentication library a lazy chunk, fetched only by a build that signs in with Entra.
 */
type Msal = typeof import('@azure/msal-browser');

/** What a started adapter holds: the client, and the module its error classes come from. */
interface Started {
  readonly client: IPublicClientApplication;
  readonly msal: Msal;
}

export const ENTRA_CONFIG = new InjectionToken<EntraAuthConfig>('ENTRA_CONFIG');

/**
 * How long after sending someone to sign in a further refusal is NOT answered with another
 * redirect. Entra keeps its own session, so a sign-in it can answer silently comes straight back;
 * if the engine still refuses the token — a wrong audience, an unregistered user — every load
 * would bounce through Entra forever. Inside the window the 401 simply surfaces as an error.
 */
export const REAUTH_WINDOW_MS = 60_000;
const REAUTH_KEY = 'qa-authoring.reauth-at';

/**
 * Reading your own profile: a delegated, low-privilege scope an ordinary user consents to for
 * themselves. Asked for at SIGN-IN beside the engine's scope, so consent is settled in the
 * redirect the user was already making — never by a prompt in the middle of their work.
 */
const GRAPH_USER_SCOPE = 'User.Read';

/** The photo's bytes (`$value`), not its metadata. 404 for someone who never set one. */
const GRAPH_PHOTO_URL = 'https://graph.microsoft.com/v1.0/me/photo/$value';

/** `<ENTRA_TENANT_ID>` and friends: the shape is right, the value has not been supplied. */
const isPlaceholder = (value: string): boolean => value.trim() === '' || value.startsWith('<');

/** Which values are still placeholders. Empty means Entra can be talked to for real. */
function missingConfig(config: EntraAuthConfig): readonly string[] {
  return (['tenantId', 'clientId', 'engineScope'] as const).filter((key) =>
    isPlaceholder(config[key]),
  );
}

/**
 * The Entra adapter behind `AuthPort`: a redirect flow, as budgetisation's.
 *
 * MSAL lives here and nowhere else. The token is never stored by this app: `authHeaders()` asks
 * MSAL per call and MSAL decides whether that is a cache hit or a silent renewal (its cache is
 * `localStorage`, so a session survives a restart). The interceptor sends the token to the
 * engine's origin only.
 *
 * SIGN-IN IS THE ENGINE'S 401. Nobody signed in means no header, the engine answers
 * `unauthenticated`, and the interceptor calls `reauthenticate()`, which redirects to Entra — so
 * no screen needed a login button, and a lapsed session takes the same path.
 *
 * The account is kept to MSAL: who the user is, as shown, is `/me`'s answer, and the Entra object
 * id is neither read nor surfaced here. The one thing taken from Entra for display is the
 * PHOTO, from Microsoft Graph, as budgetisation does — see `#fetchPhoto`.
 *
 * UNTIL REAL VALUES ARRIVE: with `<…>` placeholders this builds no MSAL instance at all —
 * `authHeaders()` answers empty, a refusal does not redirect (it says what is missing instead),
 * and `signOut()` throws by name. Nothing pretends to work.
 */
@Service({ autoProvided: false })
export class EntraAuthAdapter extends AuthPort {
  readonly #config = inject(ENTRA_CONFIG);
  readonly #storage = storageOf(inject(DOCUMENT));

  /** Resolves to null when the config is still placeholders. Started once, shared by all callers. */
  #ready: Promise<Started | null> | null = null;

  readonly #photo = signal<string | null>(null);
  readonly photo = this.#photo.asReadonly();
  /** Asked, not found: a user with no photo 404s every time, so one attempt per session. */
  #photoAsked = false;

  /**
   * Where the MSAL instance comes from. `protected` for one reason: a unit test substitutes a
   * double here, so no test ever reaches a real identity provider.
   */
  protected createClient(msal: Msal, configuration: Configuration): IPublicClientApplication {
    return new msal.PublicClientApplication(configuration);
  }

  /**
   * Initialise MSAL and finish a sign-in redirect landing on this page. Run once at bootstrap
   * (see `provideAuth`), before the router's first navigation can rewrite the URL MSAL reads its
   * answer from.
   */
  async start(): Promise<void> {
    await this.#start();
  }

  async authHeaders(): Promise<Readonly<Record<string, string>>> {
    const token = await this.#accessToken();
    return token === null ? {} : { Authorization: `Bearer ${token}` };
  }

  async reauthenticate(): Promise<void> {
    const started = await this.#start();
    if (started === null) {
      console.error(this.#notConfigured());
      return;
    }
    const last = Number(this.#storage?.getItem(REAUTH_KEY) ?? 0);
    if (Date.now() - last < REAUTH_WINDOW_MS) return;
    this.#storage?.setItem(REAUTH_KEY, String(Date.now()));

    const account = started.client.getActiveAccount();
    // Two resources, so two tokens later — but one consent, now. See GRAPH_USER_SCOPE.
    await started.client.loginRedirect({
      scopes: [this.#config.engineScope, GRAPH_USER_SCOPE],
      ...(account === null ? {} : { loginHint: account.username }),
    });
  }

  async signOut(): Promise<void> {
    const started = await this.#start();
    if (started === null) throw new Error(this.#notConfigured());
    this.#releasePhoto();
    await started.client.logoutRedirect({ postLogoutRedirectUri: this.#config.redirectUri });
  }

  async #accessToken(): Promise<string | null> {
    const started = await this.#start();
    if (started === null) return null;
    const { client, msal } = started;

    const account = client.getActiveAccount();
    if (account === null) return null;

    const request = { scopes: [this.#config.engineScope], account };
    try {
      return (await client.acquireTokenSilent(request)).accessToken;
    } catch (error: unknown) {
      if (!(error instanceof msal.InteractionRequiredAuthError)) throw error;
      // Consent, MFA, a revoked session: silence is impossible and only the user can settle it.
      // The page leaves for Entra, so there is no token to return.
      await client.acquireTokenRedirect(request);
      return null;
    }
  }

  #start(): Promise<Started | null> {
    if (this.#ready === null) {
      // A failed start is not cached: a later call gets a fresh attempt.
      this.#ready = this.#begin().catch((error: unknown) => {
        this.#ready = null;
        throw error;
      });
    }
    return this.#ready;
  }

  async #begin(): Promise<Started | null> {
    if (missingConfig(this.#config).length > 0) return null;

    const msal = await import('@azure/msal-browser');
    const client = this.createClient(msal, {
      auth: {
        clientId: this.#config.clientId,
        authority: `https://login.microsoftonline.com/${this.#config.tenantId}`,
        redirectUri: this.#config.redirectUri,
        postLogoutRedirectUri: this.#config.redirectUri,
      },
      cache: { cacheLocation: msal.BrowserCacheLocation.LocalStorage },
    });
    await client.initialize();

    // A sign-in redirect lands back on this page: this is the call that finishes it. It answers
    // null on an ordinary load, in which case any account MSAL already holds is picked up.
    const redirected = await client.handleRedirectPromise();
    const account = redirected?.account ?? client.getActiveAccount() ?? client.getAllAccounts()[0];
    if (account) client.setActiveAccount(account);
    const started = { client, msal };
    // Beside the application, not in front of it: nothing awaits the photo.
    if (account) void this.#fetchPhoto(started);
    return started;
  }

  /**
   * The photo, fetched with a Graph token of its OWN (one token, one resource — the engine's
   * would be refused by Graph and vice versa). Every failure ends the same way: no photo, and the
   * initials already on screen stay. In particular a missing consent is NOT answered with a
   * redirect, as the engine's token is — throwing someone out of their work for a picture would
   * be indefensible.
   */
  async #fetchPhoto({ client }: Started): Promise<void> {
    if (this.#photoAsked) return;
    this.#photoAsked = true;
    try {
      const account = client.getActiveAccount();
      if (account === null) return;
      const graph = await client.acquireTokenSilent({ scopes: [GRAPH_USER_SCOPE], account });
      const response = await fetch(GRAPH_PHOTO_URL, {
        headers: { Authorization: `Bearer ${graph.accessToken}` },
      });
      if (!response.ok) return;
      const blob = await response.blob();
      if (blob.size === 0) return;
      // Held for the session; released on sign-out (an object URL lives until revoked).
      this.#photo.set(URL.createObjectURL(blob));
    } catch {
      // Unconsented, offline, Graph down: no photo.
    }
  }

  #releasePhoto(): void {
    const held = this.#photo();
    if (held !== null) URL.revokeObjectURL(held);
    this.#photo.set(null);
    this.#photoAsked = false;
  }

  #notConfigured(): string {
    return (
      `Entra is not configured: ${missingConfig(this.#config).join(', ')} still hold placeholders. ` +
      'Supply them in src/app/core/config/environment*.ts once the app registration exists.'
    );
  }
}

/** Session storage, or nothing where the browser refuses it (a locked-down or private window). */
function storageOf(document: Document): Storage | null {
  try {
    return document.defaultView?.sessionStorage ?? null;
  } catch {
    return null;
  }
}
