import { TestBed } from '@angular/core/testing';
import type { AuthConfig } from '../config/environment.model';
import { AuthPort } from './auth-port';
import { DevAuthAdapter } from './dev-auth-adapter';
import { ENTRA_CONFIG, EntraAuthAdapter } from './entra-auth-adapter';
import { provideAuth } from './provide-auth';

const adapterFor = (config: AuthConfig) => {
  TestBed.configureTestingModule({ providers: [provideAuth(config)] });
  return TestBed.inject(AuthPort);
};

describe('provideAuth', () => {
  it('binds the dev adapter for the dev provider', () => {
    expect(adapterFor({ provider: 'dev', email: 'author@example.org' })).toBeInstanceOf(
      DevAuthAdapter,
    );
  });

  it('binds the Entra adapter, with its configuration, for the entra provider', () => {
    const config: AuthConfig = {
      provider: 'entra',
      tenantId: '<ENTRA_TENANT_ID>',
      clientId: '<ENTRA_SPA_CLIENT_ID>',
      engineScope: '<ENGINE_API_SCOPE>',
      redirectUri: '/',
    };

    expect(adapterFor(config)).toBeInstanceOf(EntraAuthAdapter);
    expect(TestBed.inject(ENTRA_CONFIG)).toBe(config);
  });
});
