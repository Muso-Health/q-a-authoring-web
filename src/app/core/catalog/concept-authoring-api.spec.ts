import { TestBed } from '@angular/core/testing';
import { ApiPort } from '../api/api-port';
import type { Schemas } from '../api/api-types';
import { FakeApiPort } from '../api/testing/fake-api-port';
import { ConceptAuthoringApi } from './concept-authoring-api';
import { CONCEPT, IDS, QASET_BM } from './testing/catalog-fixtures';

function setUp() {
  const api = new FakeApiPort({});
  TestBed.configureTestingModule({ providers: [{ provide: ApiPort, useValue: api }] });
  return { api, authoring: TestBed.inject(ConceptAuthoringApi) };
}

describe('ConceptAuthoringApi', () => {
  it('starts a concept in a language with its answer, and answers with its id', async () => {
    const { api, authoring } = setUp();
    api.answers[`POST /themes/${IDS.theme}/concepts`] = CONCEPT;

    const id = await authoring.createConcept(IDS.theme, IDS.fr, 'Dormez sous une moustiquaire.');

    expect(id).toBe(IDS.concept);
    expect(api.writes).toEqual([
      {
        method: 'POST',
        path: `/themes/${IDS.theme}/concepts`,
        body: { language_id: IDS.fr, answer_text: 'Dormez sous une moustiquaire.' },
      },
    ]);
  });

  it('adds and removes a language of a concept, and deletes the concept', async () => {
    const { api, authoring } = setUp();
    api.answers[`POST /concepts/${IDS.concept}/qasets`] = QASET_BM;

    await authoring.addQASet(IDS.concept, IDS.bm, 'Jaabi');
    await authoring.deleteQASet(IDS.qasetBm);
    await authoring.deleteConcept(IDS.concept);

    expect(api.writes).toEqual([
      {
        method: 'POST',
        path: `/concepts/${IDS.concept}/qasets`,
        body: { language_id: IDS.bm, answer_text: 'Jaabi' },
      },
      { method: 'DELETE', path: `/qasets/${IDS.qasetBm}`, body: undefined },
      { method: 'DELETE', path: `/concepts/${IDS.concept}`, body: undefined },
    ]);
  });

  it('writes a QASet’s answer and its variants', async () => {
    const { api, authoring } = setUp();
    const q = IDS.qasetFr;

    await authoring.updateAnswer(q, 'Nouvelle réponse');
    await authoring.addVariant(q, 'Nouvelle question ?');
    await authoring.updateVariant(q, IDS.variantFr2, 'Question reformulée ?');
    await authoring.deleteVariant(q, IDS.variantFr2);

    expect(api.writes).toEqual([
      { method: 'PATCH', path: `/qasets/${q}/answer`, body: { text: 'Nouvelle réponse' } },
      { method: 'POST', path: `/qasets/${q}/variants`, body: { text: 'Nouvelle question ?' } },
      {
        method: 'PATCH',
        path: `/qasets/${q}/variants/${IDS.variantFr2}`,
        body: { text: 'Question reformulée ?' },
      },
      { method: 'DELETE', path: `/qasets/${q}/variants/${IDS.variantFr2}`, body: undefined },
    ]);
  });

  it('translates a whole concept, or one variant, with the chosen engine', async () => {
    const { api, authoring } = setUp();

    await authoring.translateConcept(IDS.concept, IDS.ff, 'google');
    await authoring.translateVariant(IDS.qasetFr, IDS.variantFr1, IDS.bm, 'llm');

    expect(api.writes).toEqual([
      {
        method: 'POST',
        path: `/concepts/${IDS.concept}/translate`,
        body: { target_language_id: IDS.ff, engine: 'google' },
      },
      {
        method: 'POST',
        path: `/qasets/${IDS.qasetFr}/variants/${IDS.variantFr1}/translate`,
        body: { target_language_id: IDS.bm, engine: 'llm' },
      },
    ]);
  });

  it('asks for variant candidates of a QASet with the context, and answers with them', async () => {
    const { api, authoring } = setUp();
    const path = `/qasets/${IDS.qasetFr}/generate-variants`;
    api.answers[`POST ${path}`] = { candidates: ['Une ?', 'Deux ?'] };

    const candidates = await authoring.generateVariants(IDS.qasetFr, 'Enfants');

    expect(candidates).toEqual(['Une ?', 'Deux ?']);
    expect(api.writes).toEqual([{ method: 'POST', path, body: { context: 'Enfants' } }]);
  });

  it('classifies the concept with the contract’s payloads', async () => {
    const { api, authoring } = setUp();
    const c = IDS.concept;

    await authoring.attachIntent(c, 'i1');
    await authoring.detachIntent(c, 'i1');
    await authoring.addCategory(c, 'c3');
    await authoring.removeCategory(c, 'c3');

    expect(api.writes).toEqual([
      { method: 'POST', path: `/concepts/${c}/intents`, body: { intent_id: 'i1' } },
      { method: 'DELETE', path: `/concepts/${c}/intents/i1`, body: undefined },
      { method: 'POST', path: `/concepts/${c}/categories`, body: { category_id: 'c3' } },
      { method: 'DELETE', path: `/concepts/${c}/categories/c3`, body: undefined },
    ]);
  });

  it('authors pairs under a theme: an array of question and answer, and no language', async () => {
    const { api, authoring } = setUp();
    api.answers[`POST /themes/${IDS.theme}/qa-pairs`] = {
      concepts_created: 1,
      concepts_updated: 2,
      variants_added: 3,
      skipped_rows: [4],
    } satisfies Schemas['AuthoredPairsResponse'];

    const result = await authoring.authorPairs(IDS.theme, [
      { question: 'Comment se protéger ?', answer: 'Dormez sous une moustiquaire.' },
    ]);

    expect(result).toEqual({
      conceptsCreated: 1,
      conceptsUpdated: 2,
      variantsAdded: 3,
      skippedRows: [4],
    });
    expect(api.writes).toEqual([
      {
        method: 'POST',
        path: `/themes/${IDS.theme}/qa-pairs`,
        body: [{ question: 'Comment se protéger ?', answer: 'Dormez sous une moustiquaire.' }],
      },
    ]);
  });
});
