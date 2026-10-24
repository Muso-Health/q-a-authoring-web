import { Service, computed, inject, resource, type Signal } from '@angular/core';
import { ApiPort } from '../api/api-port';
import type { MeResponse } from '../api/api-types';

export const AUTHOR_QASETS = 'author_qasets';
export const MANAGE_CATALOG = 'manage_catalog';
export const MANAGE_LANGUAGES = 'manage_languages';
export const MANAGE_INTENTS = 'manage_intents';
export const MANAGE_CATEGORIES = 'manage_categories';
export const MANAGE_AUDIO = 'manage_audio';
export const VALIDATE_CLINICAL = 'validate_clinical';
export const VALIDATE_TRANSLATION = 'validate_translation';
export const VALIDATE_AUDIO = 'validate_audio';
export const MANAGE_PROMPTS = 'manage_prompts';
export const MANAGE_ACCESS = 'manage_access';

/** Each opens a section of the administration; holding any of them opens the area. */
export const ADMIN_PERMISSIONS: readonly string[] = [
  MANAGE_PROMPTS,
  MANAGE_ACCESS,
  MANAGE_CATALOG,
  MANAGE_LANGUAGES,
  MANAGE_INTENTS,
  MANAGE_CATEGORIES,
];

/**
 * Who the engine says we are, read once per session. Gates what the UI offers only: the engine
 * still enforces every permission on every call.
 */
@Service()
export class CurrentUser {
  readonly #api = inject(ApiPort);
  #me: Promise<MeResponse> | undefined;

  readonly #read = resource({ loader: () => this.#fetch() });

  readonly #permissions = computed(() =>
    this.#read.hasValue() ? new Set(this.#read.value().permissions) : new Set<string>(),
  );

  can(permission: string): Signal<boolean> {
    return computed(() => this.#permissions().has(permission));
  }

  /** For a guard, which must wait for the answer rather than read "not yet" as "no". */
  async has(permission: string): Promise<boolean> {
    try {
      return (await this.#fetch()).permissions.includes(permission);
    } catch {
      return false;
    }
  }

  #fetch(): Promise<MeResponse> {
    this.#me ??= this.#api.get<MeResponse>('/me');
    return this.#me;
  }
}
