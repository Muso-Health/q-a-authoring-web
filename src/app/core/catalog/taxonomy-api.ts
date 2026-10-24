import { Service, inject } from '@angular/core';
import { ApiPort } from '../api/api-port';
import type { Schemas } from '../api/api-types';

/** A catalogue entry as a picker shows it. */
export interface TaxonomyEntry {
  readonly id: string;
  readonly label: string;
}

/**
 * The shared intent and category catalogues. Search is by prefix, case and space insensitive;
 * registering is get-or-create, so the same text always lands on the same entry.
 */
@Service()
export class TaxonomyApi {
  readonly #api = inject(ApiPort);

  async searchIntents(prefix: string): Promise<TaxonomyEntry[]> {
    const { items } = await this.#api.get<Schemas['IntentsResponse']>('/intents', {
      params: { q: prefix },
    });
    return items.map(({ id, text }) => ({ id, label: text }));
  }

  async registerIntent(text: string): Promise<string> {
    const body: Schemas['RegisterIntentRequest'] = { text };
    return (await this.#api.post<Schemas['IntentResponse']>('/intents', body)).id;
  }

  async searchCategories(prefix: string): Promise<TaxonomyEntry[]> {
    const { items } = await this.#api.get<Schemas['CategoriesResponse']>('/categories', {
      params: { q: prefix },
    });
    return items.map(({ id, name }) => ({ id, label: name }));
  }

  async registerCategory(name: string): Promise<string> {
    const body: Schemas['RegisterCategoryRequest'] = { name };
    return (await this.#api.post<Schemas['CategoryResponse']>('/categories', body)).id;
  }
}
