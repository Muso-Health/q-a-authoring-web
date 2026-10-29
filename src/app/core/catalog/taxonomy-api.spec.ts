import { TestBed } from '@angular/core/testing';
import { ApiPort } from '../api/api-port';
import { FakeApiPort } from '../api/testing/fake-api-port';
import { TaxonomyApi } from './taxonomy-api';

function setUp(answers: Record<string, unknown>) {
  const api = new FakeApiPort(answers);
  TestBed.configureTestingModule({ providers: [{ provide: ApiPort, useValue: api }] });
  return { api, taxonomy: TestBed.inject(TaxonomyApi) };
}

describe('TaxonomyApi', () => {
  it('searches intents and categories by prefix', async () => {
    const { api, taxonomy } = setUp({
      '/intents?q=mous': { items: [{ id: 'i2', text: 'moustiquaire' }] },
      '/categories?q=enf': { items: [{ id: 'c2', name: 'Enfants de moins de 5 ans' }] },
    });

    expect(await taxonomy.searchIntents('mous')).toEqual([{ id: 'i2', label: 'moustiquaire' }]);
    expect(await taxonomy.searchCategories('enf')).toEqual([
      { id: 'c2', label: 'Enfants de moins de 5 ans' },
    ]);
    expect(api.reads).toEqual(['/intents?q=mous', '/categories?q=enf']);
  });

  it('lists a whole catalogue when there is no prefix', async () => {
    const { api, taxonomy } = setUp({
      '/intents': { items: [{ id: 'i2', text: 'moustiquaire' }] },
      '/categories': { items: [{ id: 'c1', name: 'Prévention' }] },
    });

    expect(await taxonomy.searchIntents('')).toEqual([{ id: 'i2', label: 'moustiquaire' }]);
    expect(await taxonomy.searchCategories('')).toEqual([{ id: 'c1', label: 'Prévention' }]);
    expect(api.reads).toEqual(['/intents', '/categories']);
  });

  it('registers by get-or-create and answers with the id', async () => {
    const { api, taxonomy } = setUp({
      'POST /intents': { id: 'i9', text: 'paludisme grave' },
      'POST /categories': { id: 'c9', name: 'Urgences' },
    });

    expect(await taxonomy.registerIntent('paludisme grave')).toBe('i9');
    expect(await taxonomy.registerCategory('Urgences')).toBe('c9');
    expect(api.writes).toEqual([
      { method: 'POST', path: '/intents', body: { text: 'paludisme grave' } },
      { method: 'POST', path: '/categories', body: { name: 'Urgences' } },
    ]);
  });
});
