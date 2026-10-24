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
