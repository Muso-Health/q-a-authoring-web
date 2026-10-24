import { Service, inject } from '@angular/core';
import { ApiPort } from '../api/api-port';
import type { Schemas } from '../api/api-types';

export interface PromptTemplate {
  readonly key: string;
  readonly content: string;
  /** The `{name}` placeholders the content must use, exactly. */
  readonly requiredPlaceholders: readonly string[];
  /** The last editor's email; null for the seeded default. */
  readonly updatedBy: string | null;
  readonly updatedAt: string;
}

const toTemplate = (raw: Schemas['PromptTemplateResponse']): PromptTemplate => ({
  key: raw.key,
  content: raw.content,
  requiredPlaceholders: raw.required_placeholders,
  updatedBy: raw.updated_by,
  updatedAt: raw.updated_at,
});

/** The LLM prompts the engine uses, one active template per use, shared by everyone. */
@Service()
export class PromptTemplatesApi {
  readonly #api = inject(ApiPort);

  async list(): Promise<PromptTemplate[]> {
    const { items } = await this.#api.get<Schemas['PromptTemplatesResponse']>('/prompt-templates');
    return items.map(toTemplate);
  }

  async get(key: string): Promise<PromptTemplate> {
    return toTemplate(await this.#api.get<Schemas['PromptTemplateResponse']>(this.#path(key)));
  }

  async update(key: string, content: string): Promise<void> {
    const body: Schemas['UpdatePromptTemplateRequest'] = { content };
    await this.#api.put(this.#path(key), body);
  }

  #path(key: string): string {
    return `/prompt-templates/${encodeURIComponent(key)}`;
  }
}
