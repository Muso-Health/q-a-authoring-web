import { TestBed } from '@angular/core/testing';
import { ApiPort } from '../api/api-port';
import { FakeApiPort } from '../api/testing/fake-api-port';
import { CatalogApi } from './catalog-api';
import { IDS, world } from './testing/catalog-fixtures';

function setUp(answers = world()) {
  const api = new FakeApiPort(answers);
  TestBed.configureTestingModule({ providers: [{ provide: ApiPort, useValue: api }] });
  return { api, catalog: TestBed.inject(CatalogApi) };
}

describe('CatalogApi', () => {
  it('maps projects to read models', async () => {
    const { catalog } = setUp();

    expect(await catalog.projects()).toEqual([
      {
        id: IDS.project,
        name: 'Santé communautaire Mali',
        description: 'Corpus pour les agents de santé communautaire',
        baseLanguageId: IDS.fr,
      },
    ]);
  });

  it('reads each level of the hierarchy by its parent', async () => {
    const { api, catalog } = setUp();

    expect((await catalog.protocols(IDS.project)).map((p) => p.name)).toEqual(['Paludisme']);
    expect((await catalog.themes(IDS.protocol)).map((t) => t.name)).toEqual(['Prévention']);
    expect(await catalog.qasets(IDS.theme)).toEqual([
      {
        id: IDS.qaset,
        themeId: IDS.theme,
        languages: [
          { languageId: IDS.fr, variantCount: 3 },
          { languageId: IDS.en, variantCount: 1 },
        ],
      },
      { id: IDS.qaset2, themeId: IDS.theme, languages: [{ languageId: IDS.fr, variantCount: 1 }] },
    ]);
    expect(api.reads).toEqual([
      `/projects/${IDS.project}/protocols`,
      `/protocols/${IDS.protocol}/themes`,
      `/themes/${IDS.theme}/qasets`,
    ]);
  });

  it('resolves the lineage of a theme up to its project', async () => {
    const { catalog } = setUp();

    const lineage = await catalog.lineageOfTheme(IDS.theme);

    expect(lineage.project.name).toBe('Santé communautaire Mali');
    expect(lineage.protocol.name).toBe('Paludisme');
    expect(lineage.theme.name).toBe('Prévention');
  });

  it('escapes ids in paths', async () => {
    const { api, catalog } = setUp({ '/projects/a%2Fb': {} });

    await catalog.project('a/b').catch(() => undefined);

    expect(api.reads).toEqual(['/projects/a%2Fb']);
  });

  it('reads the language list once and names languages by id, with a fallback', async () => {
    const { api, catalog } = setUp();

    const first = await catalog.languages();
    const second = await catalog.languages();

    expect(first.of(IDS.fr)).toEqual({ id: IDS.fr, code: 'fr', name: 'Français' });
    expect(second.of('unknown-id')).toEqual({ id: 'unknown-id', code: '?', name: 'unknown-' });
    expect(api.reads.filter((path) => path === '/languages')).toHaveLength(1);
  });

  it('asks again for the languages after a failed read', async () => {
    const { api, catalog } = setUp({});

    await expect(catalog.languages()).rejects.toBeDefined();
    await expect(catalog.languages()).rejects.toBeDefined();

    expect(api.reads).toEqual(['/languages', '/languages']);
  });
});
