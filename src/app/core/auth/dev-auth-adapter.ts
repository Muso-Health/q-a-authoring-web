import { InjectionToken, Service, inject } from '@angular/core';
import { AuthPort } from './auth-port';

export const DEV_USER_EMAIL = new InjectionToken<string>('DEV_USER_EMAIL');

export const DEV_USER_HEADER = 'X-Dev-User';

/** Local/dev only: the engine's `dev` provider trusts this header, so it proves nothing. */
@Service({ autoProvided: false })
export class DevAuthAdapter extends AuthPort {
  readonly #email = inject(DEV_USER_EMAIL).trim();

  async authHeaders(): Promise<Readonly<Record<string, string>>> {
    return this.#email === '' ? {} : { [DEV_USER_HEADER]: this.#email };
  }
}
