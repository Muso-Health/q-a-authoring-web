import { Service, inject } from '@angular/core';
import { ApiPort } from '../api/api-port';
import type { Schemas } from '../api/api-types';
import {
  LanguageDirectory,
  type Project,
  type Protocol,
  type ProtocolLineage,
  type QASetDetail,
  type QASetSummary,
  type Theme,
  type ThemeLineage,
} from './catalog.model';

const toProject = (p: Schemas['ProjectResponse']): Project => ({
  id: p.id,
  name: p.name,
  description: p.description,
  baseLanguageId: p.base_language_id,
});

const toProtocol = (p: Schemas['ProtocolResponse']): Protocol => ({
  id: p.id,
  projectId: p.project_id,
  name: p.name,
  description: p.description,
});

const toTheme = (t: Schemas['ThemeResponse']): Theme => ({
  id: t.id,
  protocolId: t.protocol_id,
  name: t.name,
  description: t.description,
});

const toQASetSummary = (q: Schemas['QASetSummaryResponse']): QASetSummary => ({
  id: q.id,
  themeId: q.theme_id,
  languages: q.languages.map((l) => ({ languageId: l.language_id, variantCount: l.variant_count })),
});

const at = (...segments: string[]): string =>
  segments.map((segment, i) => (i % 2 === 0 ? segment : encodeURIComponent(segment))).join('/');

/** Read access to the authoring hierarchy, as read models. */
@Service()
export class CatalogApi {
  readonly #api = inject(ApiPort);
  #languages: Promise<LanguageDirectory> | undefined;

  async projects(): Promise<Project[]> {
    return (await this.#api.get<Schemas['ProjectsResponse']>('/projects')).items.map(toProject);
  }

  async project(id: string): Promise<Project> {
    return toProject(await this.#api.get<Schemas['ProjectResponse']>(at('/projects', id)));
  }

  async protocols(projectId: string): Promise<Protocol[]> {
    const path = at('/projects', projectId, 'protocols');
    return (await this.#api.get<Schemas['ProtocolsResponse']>(path)).items.map(toProtocol);
  }

  async protocol(id: string): Promise<Protocol> {
    return toProtocol(await this.#api.get<Schemas['ProtocolResponse']>(at('/protocols', id)));
  }

  async themes(protocolId: string): Promise<Theme[]> {
    const path = at('/protocols', protocolId, 'themes');
    return (await this.#api.get<Schemas['ThemesResponse']>(path)).items.map(toTheme);
  }

  async theme(id: string): Promise<Theme> {
    return toTheme(await this.#api.get<Schemas['ThemeResponse']>(at('/themes', id)));
  }

  async qasets(themeId: string): Promise<QASetSummary[]> {
    const path = at('/themes', themeId, 'qasets');
    return (await this.#api.get<Schemas['QASetsResponse']>(path)).items.map(toQASetSummary);
  }

  qaset(id: string): Promise<QASetDetail> {
    return this.#api.get<QASetDetail>(at('/qasets', id));
  }

  async lineageOfProtocol(id: string): Promise<ProtocolLineage> {
    const protocol = await this.protocol(id);
    return { project: await this.project(protocol.projectId), protocol };
  }

  async lineageOfTheme(id: string): Promise<ThemeLineage> {
    const theme = await this.theme(id);
    return { ...(await this.lineageOfProtocol(theme.protocolId)), theme };
  }

  /** Read once per session; a failed read is forgotten so the next caller asks again. */
  languages(): Promise<LanguageDirectory> {
    this.#languages ??= this.#api
      .get<Schemas['LanguagesResponse']>('/languages')
      .then(
        ({ items }) =>
          new LanguageDirectory(items.map(({ id, code, name }) => ({ id, code, name }))),
      )
      .catch((error: unknown) => {
        this.#languages = undefined;
        throw error;
      });
    return this.#languages;
  }

  /** After the languages were changed: the next caller reads them again. */
  forgetLanguages(): void {
    this.#languages = undefined;
  }
}
