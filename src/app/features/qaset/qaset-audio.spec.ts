import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { Schemas } from '../../core/api/api-types';
import { ApiPort } from '../../core/api/api-port';
import { FakeApiPort, engineError } from '../../core/api/testing/fake-api-port';
import { RecorderPort } from '../../core/audio/recorder-port';
import { FakeRecorder } from '../../core/audio/testing/fake-recorder';
import { IDS, ME_AUTHOR, world } from '../../core/catalog/testing/catalog-fixtures';
import { provideTestI18n } from '../../core/i18n/testing/provide-test-i18n';
import { QASetPage } from './qaset-page';

const Q = `/qasets/${IDS.qaset}`;
const VARIANT_AUDIO = `POST ${Q}/variants/${IDS.variantFr2}/audio`;
const ANSWER_AUDIO = `${Q}/answers/${IDS.answerFr}/audio`;
const text = (element: Element | null | undefined) =>
  element?.textContent?.replace(/\s+/g, ' ').trim();

async function render(
  me: Schemas['MeResponse'] = ME_AUTHOR,
  prepare: (recorder: FakeRecorder) => void = () => undefined,
) {
  const api = new FakeApiPort({ ...world(), '/me': me });
  const recorder = new FakeRecorder();
  prepare(recorder);
  TestBed.configureTestingModule({
    imports: [QASetPage],
    providers: [
      provideTestI18n(),
      provideRouter([]),
      { provide: ApiPort, useValue: api },
      { provide: RecorderPort, useValue: recorder },
    ],
  });
  const fixture = TestBed.createComponent(QASetPage);
  // Attached, so focus can be asserted.
  document.body.appendChild(fixture.nativeElement);
  attached.push(fixture.nativeElement);
  fixture.componentRef.setInput('qasetId', IDS.qaset);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const settle = () => fixture.whenStable();

  const section = (code: string) =>
    element.querySelector<HTMLElement>(`section.language[data-lang="${code}"]`)!;
  const variant2 = () => section('fr').querySelectorAll<HTMLElement>('.variant')[1];
  const answer = () => section('fr').querySelector<HTMLElement>('.answer')!;
  const buttonNamed = (name: string, scope: ParentNode = element) =>
    [...scope.querySelectorAll('button')].find(
      (b) => (b.getAttribute('aria-label') ?? text(b)) === name,
    );
  const click = async (name: string, scope?: ParentNode) => {
    const button = buttonNamed(name, scope);
    if (!button) throw new Error(`no button named "${name}"`);
    button.click();
    await settle();
  };
  const choose = async (scope: ParentNode, file: File) => {
    const input = scope.querySelector<HTMLInputElement>('.capture input[type="file"]')!;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
    await settle();
  };
  const afterFirstWrite = () =>
    api.calls.slice(api.calls.findIndex((call) => !call.startsWith('GET')));
  return {
    api,
    recorder,
    fixture,
    element,
    section,
    variant2,
    answer,
    buttonNamed,
    click,
    choose,
    afterFirstWrite,
    settle,
  };
}

const attached: HTMLElement[] = [];
afterEach(() => attached.splice(0).forEach((host) => host.remove()));

describe('QASetPage audio capture', () => {
  it('shows no audio control without manage_audio, but keeps playback', async () => {
    const { element, answer, buttonNamed } = await render({
      ...ME_AUTHOR,
      permissions: ['author_qasets'],
    });

    expect(buttonNamed('Remplacer l’audio de la réponse', answer())).toBeUndefined();
    expect(buttonNamed('Supprimer l’audio de la réponse', answer())).toBeUndefined();
    expect(buttonNamed('Enregistrer l’audio de la variante 2', element)).toBeUndefined();
    expect(buttonNamed('Téléverser l’audio de la variante 2', element)).toBeUndefined();
    expect(answer().querySelector('app-audio-player')).not.toBeNull();
  });

  describe('recording', () => {
    it('records, stops, previews, then uploads to that exact variant and re-fetches', async () => {
      const { api, recorder, variant2, click, fixture, afterFirstWrite } = await render();

      await click('Enregistrer l’audio de la variante 2', variant2());
      expect(recorder.state()).toBe('recording');
      recorder.tick(7_000);
      fixture.detectChanges();
      expect(text(variant2().querySelector('.capture .timer'))).toBe('0:07');

      await click('Arrêter', variant2());
      expect(variant2().querySelector('.capture audio.preview')?.getAttribute('src')).toBe(
        'blob:preview',
      );
      expect(api.writes).toEqual([]);

      await click('Enregistrer cet audio', variant2());

      expect(afterFirstWrite()).toEqual([VARIANT_AUDIO, `GET ${Q}`]);
      const file = (api.writes[0].body as FormData).get('file') as File;
      expect(file.type).toBe('audio/webm');
      expect(file.name).toBe('enregistrement.webm');
      expect(variant2().querySelector('.capture')).toBeNull();
      expect(recorder.discarded).toBeGreaterThan(0);
    });

    it('records again on « Refaire » and sends nothing', async () => {
      const { api, recorder, variant2, click } = await render();

      await click('Enregistrer l’audio de la variante 2', variant2());
      await click('Arrêter', variant2());
      await click('Refaire', variant2());

      expect(recorder.state()).toBe('recording');
      expect(recorder.starts).toBe(2);
      expect(api.writes).toEqual([]);
    });

    it('discards on « Annuler », sends nothing, and returns focus to the trigger', async () => {
      const { api, recorder, variant2, click } = await render();

      await click('Enregistrer l’audio de la variante 2', variant2());
      await click('Arrêter', variant2());
      await click('Annuler', variant2().querySelector('.capture')!);

      expect(api.writes).toEqual([]);
      expect(recorder.state()).toBe('idle');
      expect(variant2().querySelector('.capture')).toBeNull();
      expect(document.activeElement?.getAttribute('aria-label')).toBe(
        'Enregistrer l’audio de la variante 2',
      );
    });

    it('keeps the recording when the engine refuses it, so the author can retry', async () => {
      const { api, variant2, click, afterFirstWrite } = await render();
      api.answers[VARIANT_AUDIO] = engineError(422, 'unsupported_audio_type');

      await click('Enregistrer l’audio de la variante 2', variant2());
      await click('Arrêter', variant2());
      await click('Enregistrer cet audio', variant2());

      expect(text(variant2().querySelector('.capture [role="alert"]'))).toBe(
        'Format audio non pris en charge : enregistrez à nouveau ou choisissez un autre fichier.',
      );
      expect(afterFirstWrite()).toEqual([VARIANT_AUDIO]);
      expect(variant2().querySelector('.capture audio.preview')).not.toBeNull();
    });

    it('falls back to upload when the microphone is refused', async () => {
      const { variant2, click } = await render(ME_AUTHOR, (r) => (r.nextStart = 'deny'));

      await click('Enregistrer l’audio de la variante 2', variant2());

      expect(text(variant2().querySelector('.capture'))).toContain(
        'L’accès au micro a été refusé. Vous pouvez téléverser un fichier à la place.',
      );
      expect(variant2().querySelector('.capture input[type="file"]')).not.toBeNull();
    });

    it('offers upload only where recording is unsupported, and says why', async () => {
      const { variant2, buttonNamed, click } = await render(ME_AUTHOR, (r) => r.setUnsupported());

      expect(buttonNamed('Enregistrer l’audio de la variante 2', variant2())).toBeUndefined();
      await click('Téléverser l’audio de la variante 2', variant2());

      expect(text(variant2().querySelector('.capture'))).toContain(
        'L’enregistrement au micro n’est pas disponible sur ce navigateur. Vous pouvez téléverser un fichier à la place.',
      );
    });
  });

  describe('file upload', () => {
    const ogg = () => new File(['OggS'], 'question.ogg', { type: 'audio/ogg' });

    it('uploads the chosen file to that exact variant and re-fetches', async () => {
      const { api, variant2, click, choose, afterFirstWrite } = await render();

      await click('Téléverser l’audio de la variante 2', variant2());
      expect(variant2().querySelector('.capture input[type="file"]')?.getAttribute('accept')).toBe(
        'audio/*',
      );
      await choose(variant2(), ogg());
      await click('Téléverser', variant2().querySelector('.capture')!);

      expect(afterFirstWrite()).toEqual([VARIANT_AUDIO, `GET ${Q}`]);
      const file = (api.writes[0].body as FormData).get('file') as File;
      expect(file.name).toBe('question.ogg');
    });

    it('says a file is too large, keeps the selection and sends nothing more', async () => {
      const { api, variant2, click, choose, afterFirstWrite } = await render();
      api.answers[VARIANT_AUDIO] = engineError(422, 'audio_too_large');

      await click('Téléverser l’audio de la variante 2', variant2());
      await choose(variant2(), ogg());
      await click('Téléverser', variant2().querySelector('.capture')!);

      expect(text(variant2().querySelector('.capture [role="alert"]'))).toBe(
        'Fichier trop volumineux : choisissez un fichier plus court ou plus léger.',
      );
      expect(text(variant2().querySelector('.capture .selected'))).toContain('question.ogg');
      expect(afterFirstWrite()).toEqual([VARIANT_AUDIO]);
    });
  });

  describe('existing audio', () => {
    it('replaces through the same endpoint', async () => {
      const { api, answer, click, choose, afterFirstWrite } = await render();

      await click('Remplacer l’audio de la réponse', answer());
      await click('Téléverser un fichier', answer().querySelector('.capture')!);
      await choose(answer(), new File(['RIFF'], 'reponse.wav', { type: 'audio/wav' }));
      await click('Téléverser', answer().querySelector('.capture')!);

      expect(afterFirstWrite()).toEqual([`POST ${ANSWER_AUDIO}`, `GET ${Q}`]);
      expect(api.writes).toHaveLength(1);
    });

    it('deletes only once confirmed, then re-fetches', async () => {
      const { api, answer, click, afterFirstWrite } = await render();

      await click('Supprimer l’audio de la réponse', answer());
      expect(api.writes).toEqual([]);
      await click('Confirmer', answer());

      expect(afterFirstWrite()).toEqual([`DELETE ${ANSWER_AUDIO}`, `GET ${Q}`]);
    });
  });

  describe('focus return on the in-place editors', () => {
    it('returns to « Modifier la réponse » when its editor is cancelled', async () => {
      const { answer, click } = await render();

      await click('Modifier la réponse', answer());
      await click('Annuler', answer().querySelector('form')!);

      expect(text(document.activeElement)).toBe('Modifier la réponse');
    });

    it('returns to the translate trigger when its form is cancelled', async () => {
      const { variant2, click } = await render();

      await click('Traduire la variante 2', variant2());
      await click('Annuler', variant2().querySelector('.translate')!);

      expect(document.activeElement?.getAttribute('aria-label')).toBe('Traduire la variante 2');
    });

    it('returns to « Ajouter une catégorie » when its picker closes', async () => {
      const { element, click } = await render();
      const header = element.querySelector('header')!;

      await click('Ajouter une catégorie', header);
      await click('Fermer', header);

      expect(text(document.activeElement)).toBe('Ajouter une catégorie');
    });

    it('returns to a confirmation’s trigger when it is cancelled', async () => {
      const { answer, click } = await render();

      await click('Supprimer l’audio de la réponse', answer());
      await click('Annuler', answer().querySelector('.confirm')!);

      expect(document.activeElement?.getAttribute('aria-label')).toBe(
        'Supprimer l’audio de la réponse',
      );
    });
  });
});
