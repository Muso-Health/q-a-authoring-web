import { signal } from '@angular/core';
import { AuthPort } from '../auth-port';

/** An `AuthPort` a test drives: a settable photo, and a record of sign-outs. */
export class FakeAuthPort extends AuthPort {
  readonly photo = signal<string | null>(null);
  signOuts = 0;

  async authHeaders(): Promise<Readonly<Record<string, string>>> {
    return {};
  }
  async reauthenticate(): Promise<void> {}
  async signOut(): Promise<void> {
    this.signOuts += 1;
  }
}
