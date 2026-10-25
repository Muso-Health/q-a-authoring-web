import {
  type EnvironmentProviders,
  type Provider,
  inject,
  provideAppInitializer,
} from '@angular/core';
import type { AuthConfig } from '../config/environment.model';
import { AuthPort } from './auth-port';
import { DEV_USER_EMAIL, DevAuthAdapter } from './dev-auth-adapter';
import { ENTRA_CONFIG, EntraAuthAdapter } from './entra-auth-adapter';

/**
 * Binds `AuthPort` to the adapter the environment names: `dev` locally, `entra` when deployed.
 * The only place outside the adapter that names Entra.
 */
export function provideAuth(config: AuthConfig): (Provider | EnvironmentProviders)[] {
  switch (config.provider) {
    case 'dev':
      return [
        { provide: DEV_USER_EMAIL, useValue: config.email },
        { provide: AuthPort, useClass: DevAuthAdapter },
      ];
    case 'entra':
      return [
        { provide: ENTRA_CONFIG, useValue: config },
        EntraAuthAdapter,
        { provide: AuthPort, useExisting: EntraAuthAdapter },
        // MSAL reads a returning sign-in from the URL, so it starts before the router moves it.
        provideAppInitializer(() => inject(EntraAuthAdapter).start()),
      ];
  }
}
