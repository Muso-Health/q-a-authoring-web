import { engineError } from '../../core/api/testing/fake-api-port';
import { IDS, ME_AUTHOR } from '../../core/catalog/testing/catalog-fixtures';
import {
  C,
  dialog,
  escape,
  renderConcept,
  text,
  type RenderOptions,
} from './testing/render-concept';

const FR = `/qasets/${IDS.qasetFr}`;
const VARIANT_AUDIO = `POST ${FR}/variants/${IDS.variantFr2}/audio`;
const ANSWER_AUDIO = `${FR}/answer/audio`;

type Target = 'la réponse' | `la variante ${number}`;
const NAMES: Record<string, string> = { fr: 'Français', en: 'English' };

async function render(options: RenderOptions = {}) {
  const page = await renderConcept(options);
  const capture = () => dialog()!.querySelector<HTMLElement>('.capture')!;
  const title = () => text(document.getElementById(dialog()!.getAttribute('aria-labelledby')!));
  const voices = () =>
    [...dialog()!.querySelectorAll('li.audio')].map((li) => text(li.querySelector('.voice')));
  /**
   * Opens that target's audio modal from its tool: the answer's and the main question's are in
   * the principal pair, named by their language; the other variants', in the language's tab.
   */
  const manage = (target: Target, lang = 'fr') => {
    const language = NAMES[lang];
    if (target === 'la réponse') {
      return page.click(`Gérer l’audio de la réponse (${language})`, page.pair(lang));
    }
    if (target === 'la variante 1') {
      return page.click(`Gérer l’audio de la question principale (${language})`, page.pair(lang));
    }
    return page.click(`Gérer l’audio de ${target}`, page.panel(lang));
  };
  /** Opens the target's audio modal, then its capture panel, and picks the voice. */
  const openIn = async (target: Target, voiceId: string = IDS.voiceAwa) => {
    await manage(target);
    await page.press(`Ajouter un enregistrement de ${target}`);
    page.type(capture().querySelector('select')!, voiceId);
  };
  const choose = async (file: File) => {
    const input = capture().querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
    await page.settle();
  };
  return { ...page, capture, title, voices, manage, openIn, choose };
}

const voiceOf = (body: unknown) => (body as FormData).get('voice_id');

describe('ConceptPage audio', () => {
  it('offers no audio tool without manage_audio, but keeps playback on the page', async () => {
    const { pair, panel, buttonNamed } = await render({
      me: { ...ME_AUTHOR, permissions: ['author_qasets'] },
    });

    expect(buttonNamed('Gérer l’audio de la réponse (Français)', pair('fr'))).toBeUndefined();
    expect(buttonNamed('Gérer l’audio de la variante 2', panel('fr'))).toBeUndefined();
    const answer = pair('fr').querySelector('.answer')!;
    expect(answer.querySelectorAll('app-audio-player')).toHaveLength(2);
    expect(answer.querySelector('[aria-label^="Supprimer l’audio"]')).toBeNull();
  });

  it('does not read the voices for whoever may not record', async () => {
    const { api } = await render({ me: { ...ME_AUTHOR, permissions: ['author_qasets'] } });

    expect(api.reads).not.toContain('/voices');
  });

  it('only plays on the page: managing an audio happens in its modal', async () => {
    const { card } = await render();

    expect(card().querySelector('[aria-label^="Supprimer l’audio"]')).toBeNull();
    expect(card().querySelector('[aria-label^="Ajouter un enregistrement"]')).toBeNull();
  });

  describe('the audio modal manages one target', () => {
    it('lists the answer’s audios per voice, playable with their quality', async () => {
      const { manage, title, voices } = await render();

      await manage('la réponse');

      expect(title()).toBe('Audio de la réponse (Français)');
      expect(voices()).toEqual(['Awa', 'Moussa']);
      const badges = [...dialog()!.querySelectorAll('li.audio .badge[data-kind="audio"]')];
      expect(badges.map((b) => text(b))).toEqual([
        'Qualité audio : en attente',
        'Qualité audio : validée',
      ]);
      expect(dialog()!.querySelectorAll('li.audio app-audio-player')).toHaveLength(2);
    });

    it('keeps the answer’s and each variant’s audios apart', async () => {
      const { manage, title, voices, press } = await render();

      await manage('la variante 2');
      expect(title()).toBe('Audio de la variante 2 (Français)');
      expect(voices()).toEqual([]);
      expect(dialog()!.querySelector('ul.audios')).toBeNull();
      await press('Fermer');

      await manage('la variante 3');
      expect(voices()).toEqual(['Moussa']);
      await press('Fermer');

      await manage('la variante 1');
      expect(voices()).toEqual(['Awa']);
    });

    it('closes on Escape and gives focus back to its tool', async () => {
      const { manage, settle } = await render();

      await manage('la réponse');
      escape();
      await settle();

      expect(dialog()).toBeNull();
      expect(document.activeElement?.getAttribute('aria-label')).toBe(
        'Gérer l’audio de la réponse (Français)',
      );
    });
  });

  describe('choosing the voice', () => {
    it('lists the voices catalogue, marking those that already speak the target', async () => {
      const { manage, press, capture } = await render();

      await manage('la réponse');
      await press('Ajouter un enregistrement de la réponse');

      const select = capture().querySelector('select')!;
      expect(text(capture().querySelector('label'))).toBe('Voix');
      expect([...select.options].map((o) => text(o))).toEqual([
        'Choisir une voix…',
        'Awa (remplace son enregistrement)',
        'Moussa (remplace son enregistrement)',
      ]);
    });

    it('requires a voice before recording or uploading', async () => {
      const { api, recorder, manage, press, capture } = await render();

      await manage('la variante 2');
      await press('Ajouter un enregistrement de la variante 2');
      await press('Enregistrer');

      expect(text(capture().querySelector('.field-error'))).toBe('Choisissez une voix.');
      expect(recorder.starts).toBe(0);
      expect(api.writes).toEqual([]);
    });

    it('says so when the catalogue has no voice yet', async () => {
      const { manage, press, capture } = await render({ answers: { '/voices': { items: [] } } });

      await manage('la variante 2');
      await press('Ajouter un enregistrement de la variante 2');

      expect(text(capture())).toContain(
        'Aucune voix n’est enregistrée : un administrateur doit d’abord en créer une.',
      );
      expect(capture().querySelector('select')).toBeNull();
    });
  });

  describe('adding by recording', () => {
    it('records in the chosen voice, previews, then uploads to that exact variant and re-fetches', async () => {
      const { api, recorder, press, capture, openIn, fixture, afterFirstWrite } = await render();

      await openIn('la variante 2', IDS.voiceMoussa);
      await press('Enregistrer');
      expect(recorder.state()).toBe('recording');
      recorder.tick(7_000);
      fixture.detectChanges();
      expect(text(capture().querySelector('.timer'))).toBe('0:07');

      await press('Arrêter');
      expect(capture().querySelector('audio.preview')?.getAttribute('src')).toBe('blob:preview');
      expect(api.writes).toEqual([]);

      await press('Enregistrer cet audio');

      expect(afterFirstWrite()).toEqual([VARIANT_AUDIO, `GET ${C}`]);
      const file = (api.writes[0].body as FormData).get('file') as File;
      expect(file.type).toBe('audio/webm');
      expect(file.name).toBe('enregistrement.webm');
      expect(voiceOf(api.writes[0].body)).toBe(IDS.voiceMoussa);
      // Back to the target's list, the modal still open.
      expect(dialog()).not.toBeNull();
      expect(dialog()!.querySelector('.capture')).toBeNull();
      expect(recorder.discarded).toBeGreaterThan(0);
    });

    it('records again on « Refaire » and sends nothing', async () => {
      const { api, recorder, press, openIn } = await render();

      await openIn('la variante 2');
      await press('Enregistrer');
      await press('Arrêter');
      await press('Refaire');

      expect(recorder.state()).toBe('recording');
      expect(recorder.starts).toBe(2);
      expect(api.writes).toEqual([]);
    });

    it('discards the take when the modal closes mid-recording, and sends nothing', async () => {
      const { api, recorder, press, openIn, settle } = await render();

      await openIn('la variante 2');
      await press('Enregistrer');
      escape();
      await settle();

      expect(dialog()).toBeNull();
      expect(recorder.state()).toBe('idle');
      expect(api.writes).toEqual([]);
    });

    it('keeps the recording when the engine refuses it, so the author can retry', async () => {
      const { press, capture, openIn, afterFirstWrite } = await render({
        answers: { [VARIANT_AUDIO]: engineError(422, 'unsupported_audio_type') },
      });

      await openIn('la variante 2');
      await press('Enregistrer');
      await press('Arrêter');
      await press('Enregistrer cet audio');

      expect(text(capture().querySelector('[role="alert"]'))).toBe(
        'Format audio non pris en charge : enregistrez à nouveau ou choisissez un autre fichier.',
      );
      expect(afterFirstWrite()).toEqual([VARIANT_AUDIO]);
      expect(capture().querySelector('audio.preview')).not.toBeNull();
    });

    it('falls back to upload when the microphone is refused', async () => {
      const { press, capture, openIn } = await render({ prepare: (r) => (r.nextStart = 'deny') });

      await openIn('la variante 2');
      await press('Enregistrer');

      expect(text(capture())).toContain(
        'L’accès au micro a été refusé. Vous pouvez téléverser un fichier à la place.',
      );
      expect(capture().querySelector('input[type="file"]')).not.toBeNull();
    });

    it('offers upload only where recording is unsupported, and says why', async () => {
      const { press, capture, buttonNamed, openIn } = await render({
        prepare: (r) => r.setUnsupported(),
      });

      await openIn('la variante 2');
      expect(buttonNamed('Enregistrer', capture())).toBeUndefined();
      await press('Téléverser un fichier');

      expect(text(capture())).toContain(
        'L’enregistrement au micro n’est pas disponible sur ce navigateur. Vous pouvez téléverser un fichier à la place.',
      );
    });
  });

  describe('adding by file upload', () => {
    const ogg = () => new File(['OggS'], 'question.ogg', { type: 'audio/ogg' });

    it('uploads the chosen file in the chosen voice to that exact variant and re-fetches', async () => {
      const { api, press, capture, openIn, choose, afterFirstWrite } = await render();

      await openIn('la variante 2');
      await press('Téléverser un fichier');
      expect(capture().querySelector('input[type="file"]')?.getAttribute('accept')).toBe('audio/*');
      await choose(ogg());
      await press('Téléverser');

      expect(afterFirstWrite()).toEqual([VARIANT_AUDIO, `GET ${C}`]);
      const body = api.writes[0].body as FormData;
      expect((body.get('file') as File).name).toBe('question.ogg');
      expect(body.get('voice_id')).toBe(IDS.voiceAwa);
    });

    it('says a file is too large, keeps the selection and sends nothing more', async () => {
      const { press, capture, openIn, choose, afterFirstWrite } = await render({
        answers: { [VARIANT_AUDIO]: engineError(422, 'audio_too_large') },
      });

      await openIn('la variante 2');
      await press('Téléverser un fichier');
      await choose(ogg());
      await press('Téléverser');

      expect(text(capture().querySelector('[role="alert"]'))).toBe(
        'Fichier trop volumineux : choisissez un fichier plus court ou plus léger.',
      );
      expect(text(capture().querySelector('.selected'))).toContain('question.ogg');
      expect(afterFirstWrite()).toEqual([VARIANT_AUDIO]);
    });
  });

  describe('replacing and deleting, one voice at a time', () => {
    it('replaces one voice’s recording of the answer, that voice already chosen', async () => {
      const { api, manage, press, capture, choose, afterFirstWrite } = await render();

      await manage('la réponse');
      await press('Remplacer l’audio de la réponse, voix Moussa');
      expect(capture().querySelector('select')!.value).toBe(IDS.voiceMoussa);
      await press('Téléverser un fichier');
      await choose(new File(['RIFF'], 'reponse.wav', { type: 'audio/wav' }));
      await press('Téléverser');

      expect(afterFirstWrite()).toEqual([`POST ${ANSWER_AUDIO}`, `GET ${C}`]);
      expect(voiceOf(api.writes[0].body)).toBe(IDS.voiceMoussa);
    });

    it('deletes one voice’s recording of the answer only once confirmed, then re-fetches', async () => {
      const { api, manage, press, afterFirstWrite } = await render();

      await manage('la réponse');
      await press('Supprimer l’audio de la réponse, voix Moussa');
      expect(api.writes).toEqual([]);
      await press('Confirmer');

      expect(afterFirstWrite()).toEqual([`DELETE ${ANSWER_AUDIO}/${IDS.voiceMoussa}`, `GET ${C}`]);
    });

    it('deletes a variant’s recording by its voice', async () => {
      const { manage, press, afterFirstWrite } = await render();

      await manage('la variante 3');
      await press('Supprimer l’audio de la variante 3, voix Moussa');
      await press('Confirmer');

      expect(afterFirstWrite()).toEqual([
        `DELETE ${FR}/variants/${IDS.variantFr3}/audio/${IDS.voiceMoussa}`,
        `GET ${C}`,
      ]);
    });
  });

  describe('focus return', () => {
    it('returns to « Modifier la réponse (Français) » when its modal is cancelled', async () => {
      const { pair, click, press } = await render();

      await click('Modifier la réponse (Français)', pair('fr'));
      await press('Annuler');

      expect(document.activeElement?.getAttribute('aria-label')).toBe(
        'Modifier la réponse (Français)',
      );
    });

    it('returns to the translate tool when its form is cancelled', async () => {
      const { panel, click } = await render();
      const variant2 = () => panel('fr').querySelectorAll<HTMLElement>('.variant')[0];

      await click('Traduire la variante 2', variant2());
      await click('Annuler', variant2().querySelector('.translate')!);

      expect(document.activeElement?.getAttribute('aria-label')).toBe('Traduire la variante 2');
    });

    it('returns to « Ajouter une catégorie » when its modal closes', async () => {
      const { click, press } = await render({ answers: { '/categories': { items: [] } } });

      await click('Ajouter une catégorie');
      await press('Fermer');

      expect(document.activeElement?.getAttribute('aria-label')).toBe('Ajouter une catégorie');
    });

    it('returns to a confirmation’s trigger when it is cancelled', async () => {
      const { manage, press } = await render();

      await manage('la réponse');
      await press('Supprimer l’audio de la réponse, voix Awa');
      await press('Annuler');

      expect(document.activeElement?.getAttribute('aria-label')).toBe(
        'Supprimer l’audio de la réponse, voix Awa',
      );
    });
  });
});
