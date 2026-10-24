import type { Provider } from '@angular/core';
import type { AuthConfig } from '../config/environment.model';
import { AuthPort } from './auth-port';
import { DEV_USER_EMAIL, DevAuthAdapter } from './dev-auth-adapter';

/** Binds `AuthPort` to the adapter the environment names. Entra joins as a second case. */
export function provideAuth(config: AuthConfig): Provider[] {
  switch (config.provider) {
    case 'dev':
      return [
        { provide: DEV_USER_EMAIL, useValue: config.email },
        { provide: AuthPort, useClass: DevAuthAdapter },
      ];
  }
}
