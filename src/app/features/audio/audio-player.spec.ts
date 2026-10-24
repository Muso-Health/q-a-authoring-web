import { TestBed } from '@angular/core/testing';
import { ApiPort } from '../../core/api/api-port';
import { FakeApiPort, engineError } from '../../core/api/testing/fake-api-port';
import { provideTestI18n } from '../../core/i18n/testing/provide-test-i18n';
import { AudioPlayer } from './audio-player';

const AUDIO = { id: 'a1', durationMs: 65_000, quality: 'pending' as const };
const PLAYBACK = '/audios/a1/playback-url';
const URL = 'https://storage.test/a1.webm?signature=x';

async function render(answers: Record<string, unknown>) {
  const api = new FakeApiPort(answers);
  TestBed.configureTestingModule({
    imports: [AudioPlayer],
    providers: [provideTestI18n(), { provide: ApiPort, useValue: api }],
  });
  const fixture = TestBed.createComponent(AudioPlayer);
  fixture.componentRef.setInput('audio', AUDIO);
  fixture.componentRef.setInput('label', 'la réponse');
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const play = async () => {
    element.querySelector<HTMLButtonElement>('button')!.click();
    await fixture.whenStable();
  };
  return { api, fixture, element, play };
}

describe('AudioPlayer', () => {
  it('offers to play, with the duration, and fetches nothing before it is asked', async () => {
    const { api, element } = await render({});

    const button = element.querySelector('button')!;
    expect(button.textContent).toContain('Écouter');
    expect(button.getAttribute('aria-label')).toBe('Écouter la réponse (1:05)');
    expect(element.textContent).toContain('1:05');
    expect(element.querySelector('audio')).toBeNull();
    expect(api.reads).toEqual([]);
  });

  it('fetches the signed URL on play and plays it in an audio element', async () => {
    const { api, element, play } = await render({
      [PLAYBACK]: { url: URL, expires_at: '2026-10-24T16:00:00Z' },
    });

    await play();

    expect(api.reads).toEqual([PLAYBACK]);
    const audio = element.querySelector('audio')!;
    expect(audio.getAttribute('src')).toBe(URL);
    expect(audio.hasAttribute('controls')).toBe(true);
    expect(audio.hasAttribute('autoplay')).toBe(true);
  });

  it('says it is loading while the URL is on its way', async () => {
    let resolve!: (value: unknown) => void;
    const pending = new Promise((done) => (resolve = done));
    const { element, fixture } = await render({ [PLAYBACK]: pending });

    element.querySelector<HTMLButtonElement>('button')!.click();
    fixture.detectChanges();

    expect(element.querySelector('[role="status"]')?.textContent).toContain('Chargement');
    resolve({ url: URL, expires_at: '2026-10-24T16:00:00Z' });
    await fixture.whenStable();
    expect(element.querySelector('audio')).not.toBeNull();
  });

  it('surfaces a failed URL fetch and lets the listener retry', async () => {
    const { api, element, play } = await render({
      [PLAYBACK]: engineError(404, 'audio_not_found'),
    });

    await play();

    expect(element.querySelector('[role="alert"]')?.textContent).toContain('Lecture impossible');
    await play();
    expect(api.reads).toEqual([PLAYBACK, PLAYBACK]);
  });

  it('surfaces a file the browser cannot play, e.g. an expired URL', async () => {
    const { element, fixture, play } = await render({
      [PLAYBACK]: { url: URL, expires_at: '2026-10-24T16:00:00Z' },
    });
    await play();

    element.querySelector('audio')!.dispatchEvent(new Event('error'));
    await fixture.whenStable();

    expect(element.querySelector('[role="alert"]')?.textContent).toContain('Lecture impossible');
    expect(element.querySelector('audio')).toBeNull();
  });
});
