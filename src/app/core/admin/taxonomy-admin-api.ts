import { Service, inject } from '@angular/core';
import { ApiPort, type ReadOptions } from '../api/api-port';
import type { Schemas } from '../api/api-types';
import { CatalogApi } from '../catalog/catalog-api';
import type { Language } from '../catalog/catalog.model';
import type { TaxonomyEntry } from '../catalog/taxonomy-api';

/** A blank search is no search: the whole catalogue. */
const searching = (query: string): ReadOptions =>
  query.trim() === '' ? {} : { params: { q: query.trim() } };

/**
 * The languages, intents and categories as their administrators see them: always read afresh,
 * since the point of the page is to see what just changed.
 */
@Service()
export class TaxonomyAdminApi {
  readonly #api = inject(ApiPort);
  readonly #catalog = inject(CatalogApi);

  async languages(): Promise<Language[]> {
    const { items } = await this.#api.get<Schemas['LanguagesResponse']>('/languages');
    return items.map(({ id, code, name }) => ({ id, code, name }));
  }

  /** The code is checked by the engine and fixed once registered. */
  createLanguage(code: string, name: string): Promise<void> {
    const body: Schemas['RegisterLanguageRequest'] = { code, name };
    return this.#changeLanguages(() => this.#api.post('/languages', body));
  }

  renameLanguage(languageId: string, name: string): Promise<void> {
    const body: Schemas['UpdateLanguageRequest'] = { name };
    const path = `/languages/${encodeURIComponent(languageId)}`;
    return this.#changeLanguages(() => this.#api.patch(path, body));
  }

  deleteLanguage(languageId: string): Promise<void> {
    const path = `/languages/${encodeURIComponent(languageId)}`;
    return this.#changeLanguages(() => this.#api.delete(path));
  }

  async intents(query: string): Promise<TaxonomyEntry[]> {
    const { items } = await this.#api.get<Schemas['IntentsResponse']>('/intents', searching(query));
    return items.map(({ id, text }) => ({ id, label: text }));
  }

  /** Get-or-create: registering a text already there is no error. */
  async createIntent(text: string): Promise<void> {
    const body: Schemas['RegisterIntentRequest'] = { text };
    await this.#api.post('/intents', body);
  }

  async deleteIntent(intentId: string): Promise<void> {
    await this.#api.delete(`/intents/${encodeURIComponent(intentId)}`);
  }

  async categories(query: string): Promise<TaxonomyEntry[]> {
    const { items } = await this.#api.get<Schemas['CategoriesResponse']>(
      '/categories',
      searching(query),
    );
    return items.map(({ id, name }) => ({ id, label: name }));
  }

  /** Get-or-create, as for intents. */
  async createCategory(name: string): Promise<void> {
    const body: Schemas['RegisterCategoryRequest'] = { name };
    await this.#api.post('/categories', body);
  }

  async deleteCategory(categoryId: string): Promise<void> {
    await this.#api.delete(`/categories/${encodeURIComponent(categoryId)}`);
  }

  /** The rest of the app keeps the languages for the session: make it read them again. */
  async #changeLanguages(call: () => Promise<unknown>): Promise<void> {
    try {
      await call();
    } finally {
      this.#catalog.forgetLanguages();
    }
  }
}
