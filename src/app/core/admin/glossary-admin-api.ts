import { Service, inject } from '@angular/core';
import { ApiPort, type QueryParams } from '../api/api-port';
import type { Schemas } from '../api/api-types';

export type GlossaryStatus = 'active' | 'archived';
export type GlossaryFilter = GlossaryStatus | 'all';

/** How a term is said in one language: what to write, what else it may be called, what not. */
export interface GlossaryFormDraft {
  readonly preferred: string;
  readonly synonyms: readonly string[];
  readonly avoid: readonly string[];
  readonly note: string | null;
}

export interface GlossaryForm extends GlossaryFormDraft {
  readonly languageId: string;
}

export interface GlossaryTermDraft {
  readonly label: string;
  readonly note: string | null;
}

export interface GlossaryTerm extends GlossaryTermDraft {
  readonly id: string;
  readonly status: GlossaryStatus;
  readonly forms: readonly GlossaryForm[];
}

export interface GlossaryQuery {
  readonly status: GlossaryFilter;
  /** Inside the label or any form, ignoring case and accents; blank is no search. */
  readonly search: string;
  readonly limit: number;
  readonly offset: number;
}

export interface GlossaryPage {
  readonly items: readonly GlossaryTerm[];
  /** Every term matching, beyond this page. */
  readonly total: number;
}

const toForm = (f: Schemas['GlossaryFormResponse']): GlossaryForm => ({
  languageId: f.language_id,
  preferred: f.preferred,
  synonyms: f.synonyms,
  avoid: f.avoid,
  note: f.note,
});

const toTerm = (t: Schemas['GlossaryTermResponse']): GlossaryTerm => ({
  id: t.id,
  label: t.label,
  note: t.note,
  status: t.status === 'archived' ? 'archived' : 'active',
  forms: t.forms.map(toForm),
});

const termPath = (termId: string) => `/glossary/terms/${encodeURIComponent(termId)}`;
const formPath = (termId: string, languageId: string) =>
  `${termPath(termId)}/forms/${encodeURIComponent(languageId)}`;

/**
 * The glossary of terms and their per-language forms, as its administrators see it: read a page at
 * a time, ordered by label, always afresh.
 */
@Service()
export class GlossaryAdminApi {
  readonly #api = inject(ApiPort);

  async terms({ status, search, limit, offset }: GlossaryQuery): Promise<GlossaryPage> {
    const q = search.trim();
    const params: QueryParams = { status, ...(q === '' ? {} : { q }), limit, offset };
    const page = await this.#api.get<Schemas['GlossaryTermsResponse']>('/glossary/terms', {
      params,
    });
    return { items: page.items.map(toTerm), total: page.total };
  }

  async createTerm({ label, note }: GlossaryTermDraft): Promise<void> {
    // Forms are set one language at a time, once the term exists.
    const body: Schemas['CreateGlossaryTermRequest'] = { label, note, forms: [] };
    await this.#api.post('/glossary/terms', body);
  }

  /** Both fields sent: a null note clears it. */
  async updateTerm(termId: string, { label, note }: GlossaryTermDraft): Promise<void> {
    const body: Schemas['UpdateGlossaryTermRequest'] = { label, note };
    await this.#api.patch(termPath(termId), body);
  }

  async archive(termId: string): Promise<void> {
    await this.#api.post(`${termPath(termId)}/archive`, null);
  }

  async unarchive(termId: string): Promise<void> {
    await this.#api.post(`${termPath(termId)}/unarchive`, null);
  }

  /** Creates the language's form, or replaces it whole. */
  async setForm(termId: string, languageId: string, form: GlossaryFormDraft): Promise<void> {
    const body: Schemas['GlossaryFormRequest'] = {
      preferred: form.preferred,
      synonyms: [...form.synonyms],
      avoid: [...form.avoid],
      note: form.note,
    };
    await this.#api.put(formPath(termId, languageId), body);
  }

  async removeForm(termId: string, languageId: string): Promise<void> {
    await this.#api.delete(formPath(termId, languageId));
  }
}
