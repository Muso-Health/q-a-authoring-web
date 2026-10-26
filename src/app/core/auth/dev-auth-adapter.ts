import { InjectionToken, Service, inject, signal } from '@angular/core';
import { AuthPort } from './auth-port';

export const DEV_USER_EMAIL = new InjectionToken<string>('DEV_USER_EMAIL');

export const DEV_USER_HEADER = 'X-Dev-User';

/** Local/dev only: the engine's `dev` provider trusts this header, so it proves nothing. */
@Service({ autoProvided: false })
export class DevAuthAdapter extends AuthPort {
  readonly #email = inject(DEV_USER_EMAIL).trim();

  /** No directory to ask: the header shows initials. */
  readonly photo = signal<string | null>(null).asReadonly();

  async authHeaders(): Promise<Readonly<Record<string, string>>> {
    return this.#email === '' ? {} : { [DEV_USER_HEADER]: this.#email };
  }

  /** The identity is fixed by configuration: a refusal is the engine's answer, not a lapse. */
  async reauthenticate(): Promise<void> {}

  async signOut(): Promise<void> {}
}
