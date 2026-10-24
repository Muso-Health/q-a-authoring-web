import { TestBed } from '@angular/core/testing';
import { ApiPort } from '../api/api-port';
import { FakeApiPort } from '../api/testing/fake-api-port';
import { CatalogApi } from '../catalog/catalog-api';
import { IDS, LANGUAGES } from '../catalog/testing/catalog-fixtures';
import { TaxonomyAdminApi } from './taxonomy-admin-api';
import { CATEGORIES, INTENTS, TAXONOMY_IDS } from './testing/admin-fixtures';

function setUp(answers: Record<string, unknown> = {}) {
  const api = new FakeApiPort(answers);
  TestBed.configureTestingModule({ providers: [{ provide: ApiPort, useValue: api }] });
  return { api, taxonomy: TestBed.inject(TaxonomyAdminApi) };
}

describe('TaxonomyAdminApi', () => {
  it('reads the languages afresh on every call', async () => {
    const { api, taxonomy } = setUp({ '/languages': LANGUAGES });

    expect((await taxonomy.languages())[0]).toEqual({ id: IDS.bm, code: 'bm', name: 'Bambara' });
    await taxonomy.languages();

    expect(api.reads).toEqual(['/languages', '/languages']);
  });

  it('registers, renames and deletes a language, the code never sent again', async () => {
    const { api, taxonomy } = setUp();

    await taxonomy.createLanguage('wo', 'Wolof');
    await taxonomy.renameLanguage(IDS.bm, 'Bamanankan');
    await taxonomy.deleteLanguage(IDS.ff);

    expect(api.writes).toEqual([
      { method: 'POST', path: '/languages', body: { code: 'wo', name: 'Wolof' } },
      { method: 'PATCH', path: `/languages/${IDS.bm}`, body: { name: 'Bamanankan' } },
      { method: 'DELETE', path: `/languages/${IDS.ff}` },
    ]);
  });

  it('makes the rest of the app read the languages again after a change', async () => {
    const { api, taxonomy } = setUp({ '/languages': LANGUAGES });
    const catalog = TestBed.inject(CatalogApi);

    await catalog.languages();
    await catalog.languages();
    await taxonomy.renameLanguage(IDS.bm, 'Bamanankan');
    await catalog.languages();

    expect(api.reads).toEqual(['/languages', '/languages']);
  });

  it('lists intents and categories, searching only when there is something to search', async () => {
    const { api, taxonomy } = setUp({
      '/intents': INTENTS,
      '/intents?q=uti': { items: [INTENTS.items[0]] },
      '/categories': CATEGORIES,
      '/categories?q=pa': { items: [CATEGORIES.items[1]] },
    });

    expect(await taxonomy.intents('')).toEqual([
      { id: TAXONOMY_IDS.bednet, label: 'Utiliser une moustiquaire' },
      { id: TAXONOMY_IDS.fever, label: 'Reconnaître la fièvre' },
    ]);
    expect(await taxonomy.intents('  uti ')).toHaveLength(1);
    expect(await taxonomy.categories('  ')).toHaveLength(2);
    expect(await taxonomy.categories('pa')).toEqual([
      { id: TAXONOMY_IDS.malaria, label: 'Paludisme' },
    ]);
    expect(api.reads).toEqual(['/intents', '/intents?q=uti', '/categories', '/categories?q=pa']);
  });

  it('registers and deletes intents and categories', async () => {
    const { api, taxonomy } = setUp();

    await taxonomy.createIntent('Traiter la diarrhée');
    await taxonomy.deleteIntent(TAXONOMY_IDS.fever);
    await taxonomy.createCategory('Hygiène');
    await taxonomy.deleteCategory(TAXONOMY_IDS.malaria);

    expect(api.writes).toEqual([
      { method: 'POST', path: '/intents', body: { text: 'Traiter la diarrhée' } },
      { method: 'DELETE', path: `/intents/${TAXONOMY_IDS.fever}` },
      { method: 'POST', path: '/categories', body: { name: 'Hygiène' } },
      { method: 'DELETE', path: `/categories/${TAXONOMY_IDS.malaria}` },
    ]);
  });
});
