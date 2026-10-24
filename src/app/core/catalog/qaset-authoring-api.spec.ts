import { TestBed } from '@angular/core/testing';
import { ApiPort } from '../api/api-port';
import { FakeApiPort } from '../api/testing/fake-api-port';
import { QASetAuthoringApi } from './qaset-authoring-api';
import { IDS, QASET } from './testing/catalog-fixtures';

function setUp() {
  const api = new FakeApiPort({ [`POST /themes/${IDS.theme}/qasets`]: QASET });
  TestBed.configureTestingModule({ providers: [{ provide: ApiPort, useValue: api }] });
  return { api, authoring: TestBed.inject(QASetAuthoringApi) };
}

describe('QASetAuthoringApi', () => {
  it('sends each write to its endpoint with the contract’s payload', async () => {
    const { api, authoring } = setUp();
    const q = IDS.qaset;

    await authoring.updateAnswer(q, IDS.fr, 'Nouvelle réponse');
    await authoring.addVariant(q, IDS.fr, 'Nouvelle question ?');
    await authoring.updateVariant(q, IDS.variantFr2, 'Question reformulée ?');
    await authoring.deleteVariant(q, IDS.variantFr2);
    await authoring.addLanguage(q, IDS.bm, 'Jaabi');
    await authoring.removeLanguage(q, IDS.bm);
    await authoring.deleteQASet(q);

    expect(api.writes).toEqual([
      {
        method: 'PATCH',
        path: `/qasets/${q}/languages/${IDS.fr}`,
        body: { text: 'Nouvelle réponse' },
      },
      {
        method: 'POST',
        path: `/qasets/${q}/languages/${IDS.fr}/variants`,
        body: { text: 'Nouvelle question ?' },
      },
      {
        method: 'PATCH',
        path: `/qasets/${q}/variants/${IDS.variantFr2}`,
        body: { text: 'Question reformulée ?' },
      },
      { method: 'DELETE', path: `/qasets/${q}/variants/${IDS.variantFr2}`, body: undefined },
      {
        method: 'POST',
        path: `/qasets/${q}/languages`,
        body: { language_id: IDS.bm, answer_text: 'Jaabi' },
      },
      { method: 'DELETE', path: `/qasets/${q}/languages/${IDS.bm}`, body: undefined },
      { method: 'DELETE', path: `/qasets/${q}`, body: undefined },
    ]);
  });

  it('asks the engine to translate an answer or a variant with the chosen engine', async () => {
    const { api, authoring } = setUp();
    const q = IDS.qaset;

    await authoring.translateAnswer(q, IDS.answerFr, IDS.ff, 'google');
    await authoring.translateVariant(q, IDS.variantFr1, IDS.bm, 'llm');

    expect(api.writes).toEqual([
      {
        method: 'POST',
        path: `/qasets/${q}/answers/${IDS.answerFr}/translate`,
        body: { target_language_id: IDS.ff, engine: 'google' },
      },
      {
        method: 'POST',
        path: `/qasets/${q}/variants/${IDS.variantFr1}/translate`,
        body: { target_language_id: IDS.bm, engine: 'llm' },
      },
    ]);
  });

  it('asks for variant candidates with the context, and answers with them', async () => {
    const { api, authoring } = setUp();
    const path = `/qasets/${IDS.qaset}/answers/${IDS.answerFr}/generate-variants`;
    api.answers[`POST ${path}`] = { candidates: ['Une ?', 'Deux ?'] };

    const candidates = await authoring.generateVariants(IDS.qaset, IDS.answerFr, 'Enfants');

    expect(candidates).toEqual(['Une ?', 'Deux ?']);
    expect(api.writes).toEqual([{ method: 'POST', path, body: { context: 'Enfants' } }]);
  });

  it('classifies and links with the contract’s payloads', async () => {
    const { api, authoring } = setUp();
    const q = IDS.qaset;

    await authoring.attachIntent(q, IDS.variantFr2, 'i1');
    await authoring.detachIntent(q, IDS.variantFr2, 'i1');
    await authoring.addCategory(q, 'c3');
    await authoring.removeCategory(q, 'c3');
    await authoring.linkAnswers(q, IDS.answerFr, IDS.answerBm);
    await authoring.linkVariants(q, IDS.variantFr2, IDS.variantEn1);
    await authoring.unlinkAnswers(q, 'la');
    await authoring.unlinkVariants(q, 'lv');

    expect(api.writes).toEqual([
      {
        method: 'POST',
        path: `/qasets/${q}/variants/${IDS.variantFr2}/intents`,
        body: { intent_id: 'i1' },
      },
      {
        method: 'DELETE',
        path: `/qasets/${q}/variants/${IDS.variantFr2}/intents/i1`,
        body: undefined,
      },
      { method: 'POST', path: `/qasets/${q}/categories`, body: { category_id: 'c3' } },
      { method: 'DELETE', path: `/qasets/${q}/categories/c3`, body: undefined },
      {
        method: 'POST',
        path: `/qasets/${q}/answer-links`,
        body: { answer_a_id: IDS.answerFr, answer_b_id: IDS.answerBm },
      },
      {
        method: 'POST',
        path: `/qasets/${q}/variant-links`,
        body: { variant_a_id: IDS.variantFr2, variant_b_id: IDS.variantEn1 },
      },
      { method: 'DELETE', path: `/qasets/${q}/answer-links/la`, body: undefined },
      { method: 'DELETE', path: `/qasets/${q}/variant-links/lv`, body: undefined },
    ]);
  });

  it('creates a QASet under a theme and answers with its id', async () => {
    const { api, authoring } = setUp();

    const id = await authoring.createQASet(IDS.theme, IDS.fr, 'Première réponse');

    expect(id).toBe(IDS.qaset);
    expect(api.writes).toEqual([
      {
        method: 'POST',
        path: `/themes/${IDS.theme}/qasets`,
        body: { language_id: IDS.fr, answer_text: 'Première réponse' },
      },
    ]);
  });
});
