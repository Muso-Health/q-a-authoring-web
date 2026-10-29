import { TestBed } from '@angular/core/testing';
import { ApiPort } from '../api/api-port';
import { FakeApiPort } from '../api/testing/fake-api-port';
import { ValidationApi } from './validation-api';
import { CLINICAL_A, page } from './testing/queue-fixtures';

function setUp(answers: Record<string, unknown> = {}) {
  const api = new FakeApiPort(answers);
  TestBed.configureTestingModule({ providers: [{ provide: ApiPort, useValue: api }] });
  return { api, validation: TestBed.inject(ValidationApi) };
}

describe('ValidationApi', () => {
  it('reads a queue page with its state, scope, size and cursor', async () => {
    const { api, validation } = setUp({
      '/validation-queues/clinical?state=rejected&limit=20&project_id=p1&theme_id=t1&cursor=c1':
        page([CLINICAL_A], 9, 'next'),
    });

    const result = await validation.queue('clinical', {
      state: 'rejected',
      projectId: 'p1',
      themeId: 't1',
      cursor: 'c1',
    });

    expect(result).toEqual({ items: [CLINICAL_A], total: 9, nextCursor: 'next' });
    expect(api.reads).toEqual([
      '/validation-queues/clinical?state=rejected&limit=20&project_id=p1&theme_id=t1&cursor=c1',
    ]);
  });

  it('leaves out the scope it was not given', async () => {
    const { api, validation } = setUp({
      '/validation-queues/audio?state=pending&limit=20': page([], 0),
    });

    await validation.queue('audio', { state: 'pending' });

    expect(api.reads).toEqual(['/validation-queues/audio?state=pending&limit=20']);
  });

  it('posts each decision to its subject’s endpoint, the note only when there is one', async () => {
    const { api, validation } = setUp();

    await validation.decide({ kind: 'clinical', id: 'q1' }, 'validated', '');
    await validation.decide({ kind: 'translation', id: 'q2' }, 'rejected', ' Faux sens ');
    await validation.decide({ kind: 'audio', id: 'au1' }, 'rejected', 'Bruit de fond');

    expect(api.writes).toEqual([
      { method: 'POST', path: '/qasets/q1/clinical-validation', body: { decision: 'validated' } },
      {
        method: 'POST',
        path: '/qasets/q2/translation-validation',
        body: { decision: 'rejected', note: 'Faux sens' },
      },
      {
        method: 'POST',
        path: '/audios/au1/audio-validation',
        body: { decision: 'rejected', note: 'Bruit de fond' },
      },
    ]);
  });
});
