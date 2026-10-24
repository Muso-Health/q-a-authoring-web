import { Service, computed, inject, resource, type Signal } from '@angular/core';
import { ApiPort } from '../api/api-port';
import type { MeResponse } from '../api/api-types';

export const AUTHOR_QASETS = 'author_qasets';

/**
 * Who the engine says we are, read once per session. Gates what the UI offers only: the engine
 * still enforces every permission on every call.
 */
@Service()
export class CurrentUser {
  readonly #api = inject(ApiPort);

  readonly #me = resource({ loader: () => this.#api.get<MeResponse>('/me') });

  readonly #permissions = computed(() =>
    this.#me.hasValue() ? new Set(this.#me.value().permissions) : new Set<string>(),
  );

  can(permission: string): Signal<boolean> {
    return computed(() => this.#permissions().has(permission));
  }
}
