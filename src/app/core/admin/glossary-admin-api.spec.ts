import { TestBed } from '@angular/core/testing';
import { ApiPort } from '../api/api-port';
import { FakeApiPort } from '../api/testing/fake-api-port';
import { IDS } from '../catalog/testing/catalog-fixtures';
import { GlossaryAdminApi } from './glossary-admin-api';
import {
  BEDNET_TERM,
  GLOSSARY,
  GLOSSARY_IDS,
  MALARIA_TERM,
  YELLOW_FEVER_TERM,
} from './testing/admin-fixtures';

function setUp(answers: Record<string, unknown> = {}) {
  const api = new FakeApiPort(answers);
  TestBed.configureTestingModule({ providers: [{ provide: ApiPort, useValue: api }] });
  return { api, glossary: TestBed.inject(GlossaryAdminApi) };
}

const TERMS = `/glossary/terms/${GLOSSARY_IDS.bednet}`;

describe('GlossaryAdminApi', () => {
  it('lists a page of terms with their forms, and the count of every match', async () => {
    const { glossary } = setUp({ '/glossary/terms?status=active&limit=20&offset=0': GLOSSARY });

    const page = await glossary.terms({ status: 'active', search: '', limit: 20, offset: 0 });

    expect(page.total).toBe(2);
    expect(page.items.map((term) => term.label)).toEqual(['Moustiquaire', 'Paludisme']);
    expect(page.items[0]).toEqual({
      id: GLOSSARY_IDS.bednet,
      label: 'Moustiquaire',
      note: null,
      status: 'active',
      forms: [
        {
          languageId: IDS.fr,
          preferred: 'moustiquaire imprégnée',
          synonyms: ['MII', 'moustiquaire traitée'],
          avoid: ['filet'],
          note: 'Toujours préciser « imprégnée ».',
        },
        { languageId: IDS.bm, preferred: 'sanfɛsɛ', synonyms: [], avoid: [], note: null },
      ],
    });
  });

  it('filters by status and searches only when there is something to search', async () => {
    const { api, glossary } = setUp({
      '/glossary/terms?status=archived&limit=20&offset=0': { items: [YELLOW_FEVER_TERM], total: 1 },
      '/glossary/terms?status=all&q=palu&limit=20&offset=40': { items: [MALARIA_TERM], total: 41 },
    });

    expect(
      (await glossary.terms({ status: 'archived', search: '  ', limit: 20, offset: 0 })).items[0]
        .status,
    ).toBe('archived');
    await glossary.terms({ status: 'all', search: ' palu ', limit: 20, offset: 40 });

    expect(api.reads).toEqual([
      '/glossary/terms?status=archived&limit=20&offset=0',
      '/glossary/terms?status=all&q=palu&limit=20&offset=40',
    ]);
  });

  it('creates a term with its forms at once, each a preferred form only', async () => {
    const { api, glossary } = setUp();

    await glossary.createTerm({ label: 'Diarrhée', note: null }, [
      { languageId: IDS.fr, preferred: 'diarrhée', synonyms: [], avoid: [], note: null },
    ]);

    expect(api.writes).toEqual([
      {
        method: 'POST',
        path: '/glossary/terms',
        body: {
          label: 'Diarrhée',
          note: null,
          forms: [
            { language_id: IDS.fr, preferred: 'diarrhée', synonyms: [], avoid: [], note: null },
          ],
        },
      },
    ]);
  });

  it('creates and edits a term: label and note, an empty note cleared', async () => {
    const { api, glossary } = setUp();

    await glossary.createTerm({ label: 'Moustiquaire', note: null });
    await glossary.updateTerm(GLOSSARY_IDS.bednet, { label: 'Moustiquaire', note: 'MII' });
    await glossary.updateTerm(GLOSSARY_IDS.bednet, { label: 'Moustiquaires', note: null });

    expect(api.writes).toEqual([
      {
        method: 'POST',
        path: '/glossary/terms',
        body: { label: 'Moustiquaire', note: null, forms: [] },
      },
      { method: 'PATCH', path: TERMS, body: { label: 'Moustiquaire', note: 'MII' } },
      { method: 'PATCH', path: TERMS, body: { label: 'Moustiquaires', note: null } },
    ]);
  });

  it('archives and unarchives a term', async () => {
    const { api, glossary } = setUp();

    await glossary.archive(GLOSSARY_IDS.bednet);
    await glossary.unarchive(GLOSSARY_IDS.bednet);

    expect(api.writes).toEqual([
      { method: 'POST', path: `${TERMS}/archive`, body: null },
      { method: 'POST', path: `${TERMS}/unarchive`, body: null },
    ]);
  });

  it('sets a language’s form, its synonyms and forms to avoid as lists, and removes one', async () => {
    const { api, glossary } = setUp({ [`PUT ${TERMS}/forms/${IDS.en}`]: BEDNET_TERM });

    await glossary.setForm(GLOSSARY_IDS.bednet, IDS.en, {
      preferred: 'bed net',
      synonyms: ['ITN', 'mosquito net'],
      avoid: [],
      note: null,
    });
    await glossary.removeForm(GLOSSARY_IDS.bednet, IDS.bm);

    expect(api.writes).toEqual([
      {
        method: 'PUT',
        path: `${TERMS}/forms/${IDS.en}`,
        body: { preferred: 'bed net', synonyms: ['ITN', 'mosquito net'], avoid: [], note: null },
      },
      { method: 'DELETE', path: `${TERMS}/forms/${IDS.bm}` },
    ]);
  });
});
