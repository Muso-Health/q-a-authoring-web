import { engineError } from '../../core/api/testing/fake-api-port';
import { IDS, ME_AUTHOR } from '../../core/catalog/testing/catalog-fixtures';
import { C, renderConcept, text, type RenderOptions } from './testing/render-concept';

const FR = `/qasets/${IDS.qasetFr}`;
const VARIANT_AUDIO = `POST ${FR}/variants/${IDS.variantFr2}/audio`;
const ANSWER_AUDIO = `${FR}/answer/audio`;

async function render(options: RenderOptions = {}) {
  const page = await renderConcept(options);
  const variant2 = () => page.section('fr').querySelectorAll<HTMLElement>('.variant')[1];
  const answer = () => page.section('fr').querySelector<HTMLElement>('.answer')!;
  const capture = (scope: HTMLElement) => scope.querySelector<HTMLElement>('.capture')!;
  /** Opens the capture panel on that item and picks the voice. */
  const openIn = async (
    scope: () => HTMLElement,
    label: string,
    voiceId: string = IDS.voiceAwa,
  ) => {
    await page.click(`Ajouter un enregistrement de ${label}`, scope());
    page.type(capture(scope()).querySelector('select')!, voiceId);
  };
  const choose = async (scope: ParentNode, file: File) => {
    const input = scope.querySelector<HTMLInputElement>('.capture input[type="file"]')!;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
    await page.settle();
  };
  return { ...page, variant2, answer, capture, openIn, choose };
}

const voiceOf = (body: unknown) => (body as FormData).get('voice_id');

describe('ConceptPage audio', () => {
  it('shows no audio control without manage_audio, but keeps playback', async () => {
    const { answer, variant2, buttonNamed } = await render({
      me: { ...ME_AUTHOR, permissions: ['author_qasets'] },
    });

    expect(buttonNamed('Ajouter un enregistrement de la réponse', answer())).toBeUndefined();
    expect(buttonNamed('Supprimer l’audio de la réponse, voix Awa', answer())).toBeUndefined();
    expect(buttonNamed('Ajouter un enregistrement de la variante 2', variant2())).toBeUndefined();
    expect(answer().querySelectorAll('app-audio-player')).toHaveLength(2);
  });

  it('does not read the voices for whoever may not record', async () => {
    const { api } = await render({ me: { ...ME_AUTHOR, permissions: ['author_qasets'] } });

    expect(api.reads).not.toContain('/voices');
  });

  describe('choosing the voice', () => {
    it('lists the voices catalogue, marking those that already speak the item', async () => {
      const { answer, capture, click } = await render();

      await click('Ajouter un enregistrement de la réponse', answer());

      const select = capture(answer()).querySelector('select')!;
      expect(text(capture(answer()).querySelector('label'))).toBe('Voix');
      expect([...select.options].map((o) => text(o))).toEqual([
        'Choisir une voix…',
        'Awa (remplace son enregistrement)',
        'Moussa (remplace son enregistrement)',
      ]);
    });

    it('requires a voice before recording or uploading', async () => {
      const { api, recorder, variant2, capture, click } = await render();

      await click('Ajouter un enregistrement de la variante 2', variant2());
      await click('Enregistrer', capture(variant2()));

      expect(text(capture(variant2()).querySelector('.field-error'))).toBe('Choisissez une voix.');
      expect(recorder.starts).toBe(0);
      expect(api.writes).toEqual([]);
    });

    it('says so when the catalogue has no voice yet', async () => {
      const { variant2, capture, click } = await render({ answers: { '/voices': { items: [] } } });

      await click('Ajouter un enregistrement de la variante 2', variant2());

      expect(text(capture(variant2()))).toContain(
        'Aucune voix n’est enregistrée : un administrateur doit d’abord en créer une.',
      );
      expect(capture(variant2()).querySelector('select')).toBeNull();
    });
  });

  describe('recording', () => {
    it('records in the chosen voice, previews, then uploads to that exact variant and re-fetches', async () => {
      const { api, recorder, variant2, capture, click, openIn, fixture, afterFirstWrite } =
        await render();

      await openIn(variant2, 'la variante 2', IDS.voiceMoussa);
      await click('Enregistrer', capture(variant2()));
      expect(recorder.state()).toBe('recording');
      recorder.tick(7_000);
      fixture.detectChanges();
      expect(text(capture(variant2()).querySelector('.timer'))).toBe('0:07');

      await click('Arrêter', variant2());
      expect(capture(variant2()).querySelector('audio.preview')?.getAttribute('src')).toBe(
        'blob:preview',
      );
      expect(api.writes).toEqual([]);

      await click('Enregistrer cet audio', variant2());

      expect(afterFirstWrite()).toEqual([VARIANT_AUDIO, `GET ${C}`]);
      const file = (api.writes[0].body as FormData).get('file') as File;
      expect(file.type).toBe('audio/webm');
      expect(file.name).toBe('enregistrement.webm');
      expect(voiceOf(api.writes[0].body)).toBe(IDS.voiceMoussa);
      expect(variant2().querySelector('.capture')).toBeNull();
      expect(recorder.discarded).toBeGreaterThan(0);
    });

    it('records again on « Refaire » and sends nothing', async () => {
      const { api, recorder, variant2, capture, click, openIn } = await render();

      await openIn(variant2, 'la variante 2');
      await click('Enregistrer', capture(variant2()));
      await click('Arrêter', variant2());
      await click('Refaire', variant2());

      expect(recorder.state()).toBe('recording');
      expect(recorder.starts).toBe(2);
      expect(api.writes).toEqual([]);
    });

    it('discards on « Annuler », sends nothing, and returns focus to the trigger', async () => {
      const { api, recorder, variant2, capture, click, openIn } = await render();

      await openIn(variant2, 'la variante 2');
      await click('Enregistrer', capture(variant2()));
      await click('Arrêter', variant2());
      await click('Annuler', capture(variant2()));

      expect(api.writes).toEqual([]);
      expect(recorder.state()).toBe('idle');
      expect(variant2().querySelector('.capture')).toBeNull();
      expect(document.activeElement?.getAttribute('aria-label')).toBe(
        'Ajouter un enregistrement de la variante 2',
      );
    });

    it('keeps the recording when the engine refuses it, so the author can retry', async () => {
      const { variant2, capture, click, openIn, afterFirstWrite } = await render({
        answers: { [VARIANT_AUDIO]: engineError(422, 'unsupported_audio_type') },
      });

      await openIn(variant2, 'la variante 2');
      await click('Enregistrer', capture(variant2()));
      await click('Arrêter', variant2());
      await click('Enregistrer cet audio', variant2());

      expect(text(capture(variant2()).querySelector('[role="alert"]'))).toBe(
        'Format audio non pris en charge : enregistrez à nouveau ou choisissez un autre fichier.',
      );
      expect(afterFirstWrite()).toEqual([VARIANT_AUDIO]);
      expect(capture(variant2()).querySelector('audio.preview')).not.toBeNull();
    });

    it('falls back to upload when the microphone is refused', async () => {
      const { variant2, capture, click, openIn } = await render({
        prepare: (r) => (r.nextStart = 'deny'),
      });

      await openIn(variant2, 'la variante 2');
      await click('Enregistrer', capture(variant2()));

      expect(text(capture(variant2()))).toContain(
        'L’accès au micro a été refusé. Vous pouvez téléverser un fichier à la place.',
      );
      expect(capture(variant2()).querySelector('input[type="file"]')).not.toBeNull();
    });

    it('offers upload only where recording is unsupported, and says why', async () => {
      const { variant2, capture, buttonNamed, click, openIn } = await render({
        prepare: (r) => r.setUnsupported(),
      });

      await openIn(variant2, 'la variante 2');
      expect(buttonNamed('Enregistrer', capture(variant2()))).toBeUndefined();
      await click('Téléverser un fichier', capture(variant2()));

      expect(text(capture(variant2()))).toContain(
        'L’enregistrement au micro n’est pas disponible sur ce navigateur. Vous pouvez téléverser un fichier à la place.',
      );
    });
  });

  describe('file upload', () => {
    const ogg = () => new File(['OggS'], 'question.ogg', { type: 'audio/ogg' });

    it('uploads the chosen file in the chosen voice to that exact variant and re-fetches', async () => {
      const { api, variant2, capture, click, openIn, choose, afterFirstWrite } = await render();

      await openIn(variant2, 'la variante 2');
      await click('Téléverser un fichier', capture(variant2()));
      expect(capture(variant2()).querySelector('input[type="file"]')?.getAttribute('accept')).toBe(
        'audio/*',
      );
      await choose(variant2(), ogg());
      await click('Téléverser', capture(variant2()));

      expect(afterFirstWrite()).toEqual([VARIANT_AUDIO, `GET ${C}`]);
      const body = api.writes[0].body as FormData;
      expect((body.get('file') as File).name).toBe('question.ogg');
      expect(body.get('voice_id')).toBe(IDS.voiceAwa);
    });

    it('says a file is too large, keeps the selection and sends nothing more', async () => {
      const { variant2, capture, click, openIn, choose, afterFirstWrite } = await render({
        answers: { [VARIANT_AUDIO]: engineError(422, 'audio_too_large') },
      });

      await openIn(variant2, 'la variante 2');
      await click('Téléverser un fichier', capture(variant2()));
      await choose(variant2(), ogg());
      await click('Téléverser', capture(variant2()));

      expect(text(capture(variant2()).querySelector('[role="alert"]'))).toBe(
        'Fichier trop volumineux : choisissez un fichier plus court ou plus léger.',
      );
      expect(text(capture(variant2()).querySelector('.selected'))).toContain('question.ogg');
      expect(afterFirstWrite()).toEqual([VARIANT_AUDIO]);
    });
  });

  describe('existing audios, one per voice', () => {
    it('replaces a voice’s recording of the answer through the same endpoint', async () => {
      const { api, answer, capture, click, openIn, choose, afterFirstWrite } = await render();

      await openIn(answer, 'la réponse', IDS.voiceMoussa);
      await click('Téléverser un fichier', capture(answer()));
      await choose(answer(), new File(['RIFF'], 'reponse.wav', { type: 'audio/wav' }));
      await click('Téléverser', capture(answer()));

      expect(afterFirstWrite()).toEqual([`POST ${ANSWER_AUDIO}`, `GET ${C}`]);
      expect(voiceOf(api.writes[0].body)).toBe(IDS.voiceMoussa);
    });

    it('deletes one voice’s recording only once confirmed, then re-fetches', async () => {
      const { api, answer, click, afterFirstWrite } = await render();
      const moussa = () =>
        answer().querySelector<HTMLElement>(`[data-voice="${IDS.voiceMoussa}"]`)!;

      await click('Supprimer l’audio de la réponse, voix Moussa', answer());
      expect(api.writes).toEqual([]);
      await click('Confirmer', moussa());

      expect(afterFirstWrite()).toEqual([`DELETE ${ANSWER_AUDIO}/${IDS.voiceMoussa}`, `GET ${C}`]);
    });

    it('deletes a variant’s recording by its voice', async () => {
      const { section, click, afterFirstWrite } = await render();
      const variant3 = () => section('fr').querySelectorAll<HTMLElement>('.variant')[2];

      await click('Supprimer l’audio de la variante 3, voix Moussa', variant3());
      await click('Confirmer', variant3());

      expect(afterFirstWrite()).toEqual([
        `DELETE ${FR}/variants/${IDS.variantFr3}/audio/${IDS.voiceMoussa}`,
        `GET ${C}`,
      ]);
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
      const { header, click } = await render();

      await click('Ajouter une catégorie', header());
      await click('Fermer', header());

      expect(text(document.activeElement)).toBe('Ajouter une catégorie');
    });

    it('returns to a confirmation’s trigger when it is cancelled', async () => {
      const { answer, click } = await render();

      await click('Supprimer l’audio de la réponse, voix Awa', answer());
      await click('Annuler', answer().querySelector('.confirm')!);

      expect(document.activeElement?.getAttribute('aria-label')).toBe(
        'Supprimer l’audio de la réponse, voix Awa',
      );
    });
  });
});
