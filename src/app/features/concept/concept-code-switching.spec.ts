import { CONCEPT, IDS, PROJECT_LANGUAGES } from '../../core/catalog/testing/catalog-fixtures';
import { C, qasetIn, renderConcept as render, text } from './testing/render-concept';

/** A code-switching language: the project's base (French) mixed with Bambara. */
const CS = 'aaaaaaaa-0000-0000-0000-0000000000c5';
const CS_PROJECT_LANGUAGE = {
  language_id: CS,
  code: 'fr_bm',
  name: 'Français + Bambara',
  is_base: false,
};
const LANGUAGES_PATH = `/projects/${IDS.project}/languages`;
const WITH_CS = { items: [...PROJECT_LANGUAGES.items, CS_PROJECT_LANGUAGE] };

/** The concept with a QASet in the code-switching language too. */
function translatedIntoCs() {
  const detail = structuredClone(CONCEPT);
  const qaset = structuredClone(qasetIn(detail, IDS.bm));
  detail.qasets.push({ ...qaset, id: 'eeeeeeee-0000-0000-0000-0000000000c5', language_id: CS });
  return detail;
}

const coverage = (element: HTMLElement) =>
  [...element.querySelectorAll('table tbody tr')].map((tr) =>
    [...tr.children].map((cell) => text(cell)).join(' '),
  );
const translatePanel = (element: HTMLElement) =>
  element.querySelector<HTMLElement>('.translate-concept')!;

describe('ConceptPage with a code-switching project language', () => {
  it('lists it in the coverage-by-language table, as untranslated until it has a QASet', async () => {
    const { element } = await render({ answers: { [LANGUAGES_PATH]: WITH_CS } });

    expect(coverage(element)).toContain('Français + Bambara Pas encore de traduction');
  });

  it('counts its variants and audio in the coverage table once translated', async () => {
    const { element } = await render({
      answers: { [LANGUAGES_PATH]: WITH_CS, [C]: translatedIntoCs() },
    });

    expect(coverage(element)).toContain('Français + Bambara 0 0 Oui');
  });

  it('gives it a language tab and a principal-pair row like any language', async () => {
    const { tab, pair } = await render({ answers: { [LANGUAGES_PATH]: WITH_CS } });

    expect(text(tab('fr_bm'))).toContain('Français + Bambara');
    expect(pair('fr_bm')).not.toBeNull();
  });

  it('offers it as a target of the concept’s translation, and translates into it', async () => {
    const { api, element, click, type, submit } = await render({
      answers: { [LANGUAGES_PATH]: WITH_CS },
    });

    await click('Traduire la notion');
    const select = translatePanel(element).querySelector('select')!;
    expect([...select.options].filter((o) => o.value !== '').map((o) => text(o))).toEqual([
      'Peul',
      'Français + Bambara',
    ]);
    type(select, CS);
    await submit(translatePanel(element).querySelector('form')!);

    expect(api.writes).toEqual([
      { method: 'POST', path: `${C}/translate`, body: { target_language_id: CS, engine: 'llm' } },
    ]);
  });

  describe('completeness', () => {
    const withoutPeul = {
      items: WITH_CS.items.filter((language) => language.language_id !== IDS.ff),
    };

    it('leaves the concept incomplete while it has no QASet in it', async () => {
      const { element, button } = await render({ answers: { [LANGUAGES_PATH]: withoutPeul } });

      expect(button('Traduire la notion', translatePanel(element)).disabled).toBe(false);
    });

    it('makes the concept complete once it has one', async () => {
      const { element, button } = await render({
        answers: { [LANGUAGES_PATH]: withoutPeul, [C]: translatedIntoCs() },
      });

      expect(button('Traduire la notion', translatePanel(element)).disabled).toBe(true);
    });
  });
});
