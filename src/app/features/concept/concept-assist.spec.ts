import { engineError } from '../../core/api/testing/fake-api-port';
import {
  CONCEPT,
  IDS,
  ME_READER,
  PROJECT_LANGUAGES,
} from '../../core/catalog/testing/catalog-fixtures';
import { C, dialog, renderConcept as render, text } from './testing/render-concept';

const FR = `/qasets/${IDS.qasetFr}`;
const TRANSLATE_CONCEPT = `POST ${C}/translate`;

const options = (select: HTMLSelectElement) =>
  [...select.options].filter((o) => o.value !== '').map((o) => text(o));

describe('ConceptPage engine assistance', () => {
  it('offers neither translation nor generation without author_qasets', async () => {
    const { element, buttonNamed } = await render({ me: ME_READER });

    expect(buttonNamed('Traduire la notion', element)).toBeUndefined();
    expect(buttonNamed('Traduire la variante 1', element)).toBeUndefined();
    expect(buttonNamed('Générer des variantes', element)).toBeUndefined();
  });

  it('has no translation-link controls any more', async () => {
    const { element } = await render();

    expect(element.querySelector('.links, .link-form')).toBeNull();
    expect(element.textContent).not.toContain('Lier une traduction');
  });

  describe('translating the concept', () => {
    const panel = (element: HTMLElement) =>
      element.querySelector<HTMLElement>('.translate-concept')!;

    it('offers only the project languages the concept is missing, none already present', async () => {
      const { element, click } = await render();

      await click('Traduire la notion');

      // French (base), Bambara and English are present: only Peul is missing.
      const choices = options(panel(element).querySelector('select')!);
      expect(choices).toEqual(['Peul']);
      for (const present of ['Français', 'Bambara', 'English']) {
        expect(choices).not.toContain(present);
      }
      expect(text(panel(element))).not.toContain('Une langue déjà présente est mise à jour');
    });

    it('is disabled, and says why, once every project language is present', async () => {
      const complete = {
        items: PROJECT_LANGUAGES.items.filter((l) => l.language_id !== IDS.ff),
      };
      const { element, button } = await render({
        answers: { [`/projects/${IDS.project}/languages`]: complete },
      });

      const open = button('Traduire la notion', panel(element));
      expect(open.disabled).toBe(true);
      const hint = document.getElementById(open.getAttribute('aria-describedby')!);
      expect(text(hint)).toBe('Toutes les langues du projet sont déjà présentes');
      expect(panel(element).querySelector('form')).toBeNull();
    });

    it('says why in English too', async () => {
      const complete = {
        items: PROJECT_LANGUAGES.items.filter((l) => l.language_id !== IDS.ff),
      };
      const { element } = await render({
        answers: { [`/projects/${IDS.project}/languages`]: complete },
        language: 'en',
      });

      expect(text(panel(element))).toContain('All project languages are already present');
    });

    it('lets the author choose the engine, LLM by default', async () => {
      const { element, click } = await render();

      await click('Traduire la notion');

      const engines = [...panel(element).querySelectorAll<HTMLInputElement>('input[type="radio"]')];
      expect(engines.map((r) => [r.value, r.checked])).toEqual([
        ['llm', true],
        ['google', false],
      ]);
      expect(text(panel(element).querySelector('legend'))).toBe('Moteur de traduction');
    });

    it('translates the concept into the chosen language with the chosen engine, then re-fetches', async () => {
      const { api, element, click, type, toggle, submit, afterFirstWrite } = await render();

      await click('Traduire la notion');
      type(panel(element).querySelector('select')!, IDS.ff);
      toggle(panel(element).querySelector<HTMLInputElement>('input[value="google"]')!);
      await submit(panel(element).querySelector('form')!);

      expect(api.writes).toEqual([
        {
          method: 'POST',
          path: `${C}/translate`,
          body: { target_language_id: IDS.ff, engine: 'google' },
        },
      ]);
      expect(afterFirstWrite()).toEqual([TRANSLATE_CONCEPT, `GET ${C}`]);
      expect(panel(element).querySelector('form')).toBeNull();
    });

    it('says so when the concept has no base-language QASet to translate from', async () => {
      const noBase = structuredClone(CONCEPT);
      noBase.qasets = noBase.qasets.filter((q) => q.language_id !== IDS.fr);
      const { element, buttonNamed } = await render({ answers: { [C]: noBase } });

      expect(buttonNamed('Traduire la notion')).toBeUndefined();
      expect(text(panel(element))).toContain('il n’y a rien à traduire');
    });

    it('shows the engine’s refusal and keeps the form', async () => {
      const { api, element, click, type, submit } = await render({
        answers: { [TRANSLATE_CONCEPT]: engineError(422, 'language_not_in_project') },
      });

      await click('Traduire la notion');
      type(panel(element).querySelector('select')!, IDS.ff);
      await submit(panel(element).querySelector('form')!);

      expect(text(panel(element).querySelector('[role="alert"]'))).toBe(
        'Cette langue n’est pas une langue du projet.',
      );
      expect(panel(element).querySelector('form')).not.toBeNull();
      expect(api.writes).toHaveLength(1);
    });
  });

  describe('translating a variant', () => {
    it('opens in a modal titled for the variant, not in place', async () => {
      const { pair, click } = await render();

      await click('Traduire la question principale (Français)', pair('fr'));

      const title = document.getElementById(dialog()!.getAttribute('aria-labelledby')!);
      expect(text(title)).toBe('Traduire la question principale (Français)');
      expect(dialog()!.getAttribute('aria-modal')).toBe('true');
      expect(pair('fr').querySelector('form')).toBeNull();
    });

    it('offers only the other languages the concept already has a QASet in', async () => {
      const { pair, click } = await render();

      await click('Traduire la question principale (Français)', pair('fr'));

      expect(options(dialog()!.querySelector('select')!)).toEqual(['English', 'Bambara']);
    });

    it('translates a variant into that language’s QASet, then re-fetches', async () => {
      const { api, pair, click, type, submit, afterFirstWrite } = await render();

      await click('Traduire la question principale (Français)', pair('fr'));
      type(dialog()!.querySelector('select')!, IDS.bm);
      await submit(dialog()!.querySelector('form')!);

      expect(api.writes).toEqual([
        {
          method: 'POST',
          path: `${FR}/variants/${IDS.variantFr1}/translate`,
          body: { target_language_id: IDS.bm, engine: 'llm' },
        },
      ]);
      expect(afterFirstWrite()).toEqual([
        `POST ${FR}/variants/${IDS.variantFr1}/translate`,
        `GET ${C}`,
      ]);
      expect(dialog()).toBeNull();
    });

    const refusals: [number, string, string][] = [
      [
        409,
        'language_presence_required',
        'Cette notion n’a pas encore cette langue : ajoutez-la, ou traduisez la notion, d’abord.',
      ],
      [422, 'same_language', 'Les deux langues sont identiques : choisissez-en une autre.'],
      [422, 'unknown_engine', 'Ce moteur de traduction n’est pas disponible.'],
      [
        422,
        'unsupported_language_for_engine',
        'Ce moteur ne sait pas traduire vers cette langue : essayez l’autre moteur.',
      ],
      [
        502,
        'translation_engine_error',
        'Le moteur de traduction a échoué : rien n’a été ajouté. Réessayez.',
      ],
    ];
    for (const [status, code, message] of refusals) {
      it(`says so in French when the engine answers ${code}, and adds nothing`, async () => {
        const path = `POST ${FR}/variants/${IDS.variantFr1}/translate`;
        const { pair, panel, click, type, submit, afterFirstWrite } = await render({
          answers: { [path]: engineError(status, code) },
        });

        await click('Traduire la question principale (Français)', pair('fr'));
        type(dialog()!.querySelector('select')!, IDS.en);
        await submit(dialog()!.querySelector('form')!);

        expect(text(dialog()!.querySelector('[role="alert"]'))).toBe(message);
        expect(afterFirstWrite()).toEqual([path]);
        expect(panel('en').querySelectorAll('.variant')).toHaveLength(0);
        expect(dialog()!.querySelector('form')).not.toBeNull();
      });
    }
  });
});
