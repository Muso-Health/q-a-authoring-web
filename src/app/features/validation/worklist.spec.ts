import { TestBed } from '@angular/core/testing';
import { ApplicationRef } from '@angular/core';
import { ApiPort } from '../../core/api/api-port';
import { FakeApiPort, engineError } from '../../core/api/testing/fake-api-port';
import { provideTestI18n } from '../../core/i18n/testing/provide-test-i18n';
import {
  CLINICAL_A,
  CLINICAL_B,
  CLINICAL_C,
  page,
  queuePath,
} from '../../core/validation/testing/queue-fixtures';
import { Worklist } from './worklist';

const PAGE_2 = queuePath('clinical', `&cursor=${CLINICAL_B.qaset_id}`);

async function setUp(answers: Record<string, unknown>) {
  const api = new FakeApiPort(answers);
  TestBed.configureTestingModule({
    providers: [provideTestI18n(), Worklist, { provide: ApiPort, useValue: api }],
  });
  const worklist = TestBed.inject(Worklist);
  const stable = () => TestBed.inject(ApplicationRef).whenStable();
  worklist.open('clinical');
  await stable();
  return { api, worklist, stable };
}

const twoPages = () => ({
  [queuePath('clinical')]: page([CLINICAL_A, CLINICAL_B], 3, CLINICAL_B.qaset_id),
  [PAGE_2]: page([CLINICAL_C], 3, null),
});

describe('Worklist', () => {
  it('opens on the first pending item, with the total for progress', async () => {
    const { worklist } = await setUp(twoPages());

    expect(worklist.current()?.key).toBe(CLINICAL_A.qaset_id);
    expect(worklist.total()).toBe(3);
    expect(worklist.remaining()).toBe(3);
  });

  it('records a decision, then the next item becomes current', async () => {
    const { api, worklist, stable } = await setUp(twoPages());

    await worklist.decide('validated', 'RAS');
    await stable();

    expect(api.writes).toEqual([
      {
        method: 'POST',
        path: `/qasets/${CLINICAL_A.qaset_id}/clinical-validation`,
        body: { decision: 'validated', note: 'RAS' },
      },
    ]);
    expect(worklist.current()?.key).toBe(CLINICAL_B.qaset_id);
    expect(worklist.decided()).toBe(1);
    expect(worklist.remaining()).toBe(2);
  });

  it('loads the next page once the current item is the last one loaded', async () => {
    const { api, worklist, stable } = await setUp(twoPages());

    await worklist.decide('validated', '');
    await stable();

    expect(api.reads).toContain(PAGE_2);
    await worklist.decide('rejected', '');
    await stable();
    expect(worklist.current()?.key).toBe(CLINICAL_C.qaset_id);
  });

  it('skips without deciding, and can step back', async () => {
    const { api, worklist, stable } = await setUp(twoPages());

    worklist.next();
    await stable();
    expect(worklist.current()?.key).toBe(CLINICAL_B.qaset_id);
    worklist.previous();
    expect(worklist.current()?.key).toBe(CLINICAL_A.qaset_id);
    expect(api.writes).toEqual([]);
    expect(worklist.remaining()).toBe(3);
  });

  it('reaches the end once everything loaded has been seen', async () => {
    const { worklist, stable } = await setUp({
      [queuePath('clinical')]: page([CLINICAL_A], 1, null),
    });

    await worklist.decide('validated', '');
    await stable();

    expect(worklist.current()).toBeNull();
    expect(worklist.finished()).toBe(true);
  });

  it('re-queries from the start when the scope or the state changes', async () => {
    const { api, worklist, stable } = await setUp({
      ...twoPages(),
      [queuePath('clinical').replace('pending', 'rejected')]: page([CLINICAL_B], 1),
      [queuePath('clinical', '&project_id=p1&theme_id=t1')]: page([CLINICAL_C], 1),
    });

    worklist.filter({ state: 'rejected' });
    await stable();
    expect(worklist.current()?.key).toBe(CLINICAL_B.qaset_id);

    worklist.filter({ state: 'pending', projectId: 'p1', themeId: 't1' });
    await stable();
    expect(worklist.current()?.key).toBe(CLINICAL_C.qaset_id);
    expect(api.reads.at(-1)).toBe(queuePath('clinical', '&project_id=p1&theme_id=t1'));
  });

  it('keeps the item and says why when the engine refuses the decision', async () => {
    const { api, worklist, stable } = await setUp(twoPages());
    api.answers[`POST /qasets/${CLINICAL_A.qaset_id}/clinical-validation`] = engineError(
      409,
      'no_base_language_presence',
    );

    expect(await worklist.decide('validated', '')).toBe(false);
    await stable();

    expect(worklist.current()?.key).toBe(CLINICAL_A.qaset_id);
    expect(worklist.decisionError()).toBe(
      'Cet ensemble n’a pas de réponse dans la langue de base du projet : il ne peut pas être validé cliniquement.',
    );
  });

  it('drops an item that is gone, and moves on', async () => {
    const { api, worklist, stable } = await setUp(twoPages());
    api.answers[`POST /qasets/${CLINICAL_A.qaset_id}/clinical-validation`] = engineError(
      404,
      'qaset_not_found',
    );

    await worklist.decide('validated', '');
    await stable();

    expect(worklist.current()?.key).toBe(CLINICAL_B.qaset_id);
    expect(worklist.notice()).toContain('n’existe plus');
  });
});
