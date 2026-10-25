import { TestBed } from '@angular/core/testing';
import {
  InteractionRequiredAuthError,
  type AccountInfo,
  type AuthenticationResult,
  type Configuration,
  type IPublicClientApplication,
} from '@azure/msal-browser';
import type { EntraAuthConfig } from '../config/environment.model';
import { AuthPort } from './auth-port';
import { ENTRA_CONFIG, EntraAuthAdapter, REAUTH_WINDOW_MS } from './entra-auth-adapter';

const CONFIG: EntraAuthConfig = {
  provider: 'entra',
  tenantId: '11111111-1111-1111-1111-111111111111',
  clientId: '22222222-2222-2222-2222-222222222222',
  engineScope: 'api://engine/access_as_user',
  redirectUri: '/',
};

/** What the environment files ship until the app registration exists. */
const PLACEHOLDERS: EntraAuthConfig = {
  provider: 'entra',
  tenantId: '<ENTRA_TENANT_ID>',
  clientId: '<ENTRA_SPA_CLIENT_ID>',
  engineScope: '<ENGINE_API_SCOPE>',
  redirectUri: '/',
};

const ACCOUNT = {
  homeAccountId: 'home-id',
  localAccountId: 'local-id',
  environment: 'login.microsoftonline.com',
  tenantId: CONFIG.tenantId,
  username: 'author@example.org',
  name: 'Une Autrice',
} as AccountInfo;

const resultFor = (accessToken: string): AuthenticationResult =>
  ({ accessToken, account: ACCOUNT }) as AuthenticationResult;

/**
 * Stands in for MSAL. A unit test must never reach a real identity provider, and MSAL's own
 * behaviour is not what is under test here — what this app does with it is.
 */
class FakeMsalClient {
  configuration: Configuration | null = null;
  activeAccount: AccountInfo | null = null;
  redirectResult: AuthenticationResult | null = null;
  silent: () => Promise<AuthenticationResult> = async () => resultFor('engine-token');
  readonly calls: { method: string; request?: unknown }[] = [];

  async initialize(): Promise<void> {
    this.calls.push({ method: 'initialize' });
  }
  async handleRedirectPromise(): Promise<AuthenticationResult | null> {
    return this.redirectResult;
  }
  getAllAccounts(): AccountInfo[] {
    return this.activeAccount === null ? [] : [this.activeAccount];
  }
  getActiveAccount(): AccountInfo | null {
    return this.activeAccount;
  }
  setActiveAccount(account: AccountInfo | null): void {
    this.activeAccount = account;
  }
  async acquireTokenSilent(request: unknown): Promise<AuthenticationResult> {
    this.calls.push({ method: 'acquireTokenSilent', request });
    return this.silent();
  }
  async acquireTokenRedirect(request: unknown): Promise<void> {
    this.calls.push({ method: 'acquireTokenRedirect', request });
  }
  async loginRedirect(request: unknown): Promise<void> {
    this.calls.push({ method: 'loginRedirect', request });
  }
  async logoutRedirect(request: unknown): Promise<void> {
    this.calls.push({ method: 'logoutRedirect', request });
  }
  methods(): string[] {
    return this.calls.map((call) => call.method);
  }
  requestOf(method: string): unknown {
    return this.calls.find((call) => call.method === method)?.request;
  }
}

function setUp(config: EntraAuthConfig = CONFIG) {
  const client = new FakeMsalClient();
  let created = 0;

  class TestAdapter extends EntraAuthAdapter {
    protected override createClient(_msal: unknown, configuration: Configuration) {
      created += 1;
      client.configuration = configuration;
      return client as unknown as IPublicClientApplication;
    }
  }

  TestBed.configureTestingModule({
    providers: [
      { provide: ENTRA_CONFIG, useValue: config },
      { provide: AuthPort, useClass: TestAdapter },
    ],
  });
  return {
    client,
    auth: TestBed.inject(AuthPort) as EntraAuthAdapter,
    created: () => created,
  };
}

describe('EntraAuthAdapter', () => {
  beforeEach(() => sessionStorage.clear());

  it('configures MSAL for the tenant, the SPA and a localStorage cache, once', async () => {
    const { auth, client, created } = setUp();
    client.activeAccount = ACCOUNT;

    await auth.authHeaders();
    await auth.authHeaders();

    expect(created()).toBe(1);
    expect(client.methods().filter((method) => method === 'initialize')).toHaveLength(1);
    expect(client.configuration?.auth).toEqual({
      clientId: CONFIG.clientId,
      authority: `https://login.microsoftonline.com/${CONFIG.tenantId}`,
      redirectUri: '/',
      postLogoutRedirectUri: '/',
    });
    expect(client.configuration?.cache?.cacheLocation).toBe('localStorage');
  });

  it('answers with a bearer token for the engine’s scope, acquired silently', async () => {
    const { auth, client } = setUp();
    client.activeAccount = ACCOUNT;

    expect(await auth.authHeaders()).toEqual({ Authorization: 'Bearer engine-token' });
    expect(client.requestOf('acquireTokenSilent')).toEqual({
      scopes: [CONFIG.engineScope],
      account: ACCOUNT,
    });
  });

  it('finishes a sign-in redirect landing on this page and adopts its account', async () => {
    const { auth, client } = setUp();
    client.redirectResult = resultFor('fresh');

    await auth.start();

    expect(client.activeAccount).toBe(ACCOUNT);
    expect(await auth.authHeaders()).toEqual({ Authorization: 'Bearer engine-token' });
  });

  it('sends nothing while nobody is signed in — the engine’s 401 starts the sign-in', async () => {
    const { auth, client } = setUp();

    expect(await auth.authHeaders()).toEqual({});
    expect(client.methods()).not.toContain('acquireTokenSilent');
  });

  it('falls back to an interactive redirect when silence is impossible', async () => {
    const { auth, client } = setUp();
    client.activeAccount = ACCOUNT;
    client.silent = async () => {
      throw new InteractionRequiredAuthError('interaction_required', 'consent needed');
    };

    expect(await auth.authHeaders()).toEqual({});
    expect(client.requestOf('acquireTokenRedirect')).toEqual({
      scopes: [CONFIG.engineScope],
      account: ACCOUNT,
    });
  });

  it('lets any other failure surface rather than call the engine as nobody', async () => {
    const { auth, client } = setUp();
    client.activeAccount = ACCOUNT;
    client.silent = async () => {
      throw new Error('network down');
    };

    await expect(auth.authHeaders()).rejects.toThrow('network down');
  });

  describe('re-authentication, after the engine refused a call', () => {
    it('sends the user to sign in again, for the engine’s scope', async () => {
      const { auth, client } = setUp();
      client.activeAccount = ACCOUNT;

      await auth.reauthenticate();

      expect(client.requestOf('loginRedirect')).toEqual({
        scopes: [CONFIG.engineScope],
        loginHint: ACCOUNT.username,
      });
    });

    it('does not loop: a second refusal soon after the last sign-in is left to surface', async () => {
      const { auth, client } = setUp();
      const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);

      await auth.reauthenticate();
      now.mockReturnValue(1_000_000 + REAUTH_WINDOW_MS - 1);
      await auth.reauthenticate();
      expect(client.methods().filter((method) => method === 'loginRedirect')).toHaveLength(1);

      now.mockReturnValue(1_000_000 + REAUTH_WINDOW_MS + 1);
      await auth.reauthenticate();
      expect(client.methods().filter((method) => method === 'loginRedirect')).toHaveLength(2);
      now.mockRestore();
    });
  });

  it('signs out through Entra, back to the app', async () => {
    const { auth, client } = setUp();
    client.activeAccount = ACCOUNT;

    await auth.signOut();

    expect(client.requestOf('logoutRedirect')).toEqual({ postLogoutRedirectUri: '/' });
  });

  describe('until the app registration values are supplied', () => {
    it('builds no MSAL client and sends no header', async () => {
      const { auth, created } = setUp(PLACEHOLDERS);

      await auth.start();

      expect(await auth.authHeaders()).toEqual({});
      expect(created()).toBe(0);
    });

    it('does not redirect on a refusal, and refuses sign-out by name', async () => {
      const { auth, created } = setUp(PLACEHOLDERS);
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await auth.reauthenticate();

      expect(created()).toBe(0);
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining('tenantId, clientId, engineScope'),
      );
      await expect(auth.signOut()).rejects.toThrow(/not configured/);
      error.mockRestore();
    });
  });
});
