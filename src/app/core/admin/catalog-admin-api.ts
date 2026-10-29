import { Service, inject } from '@angular/core';
import { ApiPort } from '../api/api-port';
import type { Schemas } from '../api/api-types';

/** What a project, protocol or theme is edited by. A null description is none, or clears it. */
export interface NamedDraft {
  readonly name: string;
  readonly description: string | null;
}

const at = (...segments: string[]): string =>
  segments.map((segment, i) => (i % 2 === 0 ? segment : encodeURIComponent(segment))).join('/');

const toCreate = ({ name, description }: NamedDraft): Schemas['CreateNamedRequest'] =>
  description === null ? { name } : { name, description };

const toUpdate = ({ name, description }: NamedDraft): Schemas['UpdateNamedRequest'] => ({
  name,
  description,
});

/**
 * Writes to the project > protocol > theme hierarchy; reads stay with `CatalogApi`. The engine
 * refuses to delete a level that still has children, and a project's base language is fixed.
 */
@Service()
export class CatalogAdminApi {
  readonly #api = inject(ApiPort);

  async createProject(draft: NamedDraft, baseLanguageId: string): Promise<void> {
    const body: Schemas['CreateProjectRequest'] = {
      ...toCreate(draft),
      base_language_id: baseLanguageId,
    };
    await this.#api.post('/projects', body);
  }

  async updateProject(projectId: string, draft: NamedDraft): Promise<void> {
    await this.#api.patch(at('/projects', projectId), toUpdate(draft));
  }

  async deleteProject(projectId: string): Promise<void> {
    await this.#api.delete(at('/projects', projectId));
  }

  async createProtocol(projectId: string, draft: NamedDraft): Promise<void> {
    await this.#api.post(at('/projects', projectId, 'protocols'), toCreate(draft));
  }

  async updateProtocol(protocolId: string, draft: NamedDraft): Promise<void> {
    await this.#api.patch(at('/protocols', protocolId), toUpdate(draft));
  }

  async deleteProtocol(protocolId: string): Promise<void> {
    await this.#api.delete(at('/protocols', protocolId));
  }

  async createTheme(protocolId: string, draft: NamedDraft): Promise<void> {
    await this.#api.post(at('/protocols', protocolId, 'themes'), toCreate(draft));
  }

  async updateTheme(themeId: string, draft: NamedDraft): Promise<void> {
    await this.#api.patch(at('/themes', themeId), toUpdate(draft));
  }

  async deleteTheme(themeId: string): Promise<void> {
    await this.#api.delete(at('/themes', themeId));
  }

  /** Lets the project's content use a catalogue language; adding one it has changes nothing. */
  async addProjectLanguage(projectId: string, languageId: string): Promise<void> {
    await this.#api.put(at('/projects', projectId, 'languages', languageId), undefined);
  }

  /** Refused for the base language, and while the project's content uses the language. */
  async removeProjectLanguage(projectId: string, languageId: string): Promise<void> {
    await this.#api.delete(at('/projects', projectId, 'languages', languageId));
  }
}
