import { TestBed } from '@angular/core/testing';
import { ApiPort } from '../api/api-port';
import { FakeApiPort } from '../api/testing/fake-api-port';
import { AudioApi } from './audio-api';

function setUp(answers: Record<string, unknown> = {}) {
  const api = new FakeApiPort(answers);
  TestBed.configureTestingModule({ providers: [{ provide: ApiPort, useValue: api }] });
  return { api, audio: TestBed.inject(AudioApi) };
}

describe('AudioApi', () => {
  it('reads a playback URL', async () => {
    const { audio } = setUp({ '/audios/a1/playback-url': { url: 'https://x', expires_at: 'y' } });

    expect(await audio.playbackUrl('a1')).toBe('https://x');
  });

  it('sets an answer’s or a variant’s audio as a multipart file', async () => {
    const { api, audio } = setUp();
    const blob = new Blob(['bytes'], { type: 'audio/webm' });

    await audio.setAudio('q1', 'answer', 'an1', blob, 'enregistrement.webm');
    await audio.setAudio('q1', 'variant', 'v1', blob, 'question.ogg');

    expect(api.writes.map((w) => `${w.method} ${w.path}`)).toEqual([
      'POST /qasets/q1/answers/an1/audio',
      'POST /qasets/q1/variants/v1/audio',
    ]);
    const body = api.writes[0].body as FormData;
    expect(body).toBeInstanceOf(FormData);
    const file = body.get('file') as File;
    expect(file.name).toBe('enregistrement.webm');
    expect(file.type).toBe('audio/webm');
  });

  it('deletes an answer’s or a variant’s audio', async () => {
    const { api, audio } = setUp();

    await audio.deleteAudio('q1', 'answer', 'an1');
    await audio.deleteAudio('q1', 'variant', 'v1');

    expect(api.writes.map((w) => `${w.method} ${w.path}`)).toEqual([
      'DELETE /qasets/q1/answers/an1/audio',
      'DELETE /qasets/q1/variants/v1/audio',
    ]);
  });
});
