import { TestBed } from '@angular/core/testing';
import { ApiPort } from '../api/api-port';
import { FakeApiPort } from '../api/testing/fake-api-port';
import { IDS, VOICES } from '../catalog/testing/catalog-fixtures';
import { VoicesApi } from './voices-api';

function setUp(answers: Record<string, unknown> = { '/voices': VOICES }) {
  const api = new FakeApiPort(answers);
  TestBed.configureTestingModule({ providers: [{ provide: ApiPort, useValue: api }] });
  return { api, voices: TestBed.inject(VoicesApi) };
}

describe('VoicesApi', () => {
  it('reads the catalogue of voices', async () => {
    const { voices } = setUp();

    expect(await voices.list()).toEqual([
      { id: IDS.voiceAwa, name: 'Awa', note: 'Voix féminine, Bamako' },
      { id: IDS.voiceMoussa, name: 'Moussa', note: null },
    ]);
  });

  it('creates, edits and deletes a voice with the contract’s payloads', async () => {
    const { api, voices } = setUp();

    await voices.create({ name: 'Fatou', note: null });
    await voices.create({ name: 'Ibrahim', note: 'Voix grave' });
    await voices.update(IDS.voiceAwa, { name: 'Awa D.', note: null });
    await voices.delete('v/1');

    expect(api.writes).toEqual([
      { method: 'POST', path: '/voices', body: { name: 'Fatou' } },
      { method: 'POST', path: '/voices', body: { name: 'Ibrahim', note: 'Voix grave' } },
      { method: 'PATCH', path: `/voices/${IDS.voiceAwa}`, body: { name: 'Awa D.', note: null } },
      { method: 'DELETE', path: '/voices/v%2F1', body: undefined },
    ]);
  });
});
