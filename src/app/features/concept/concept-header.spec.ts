import { IDS, ME_READER } from '../../core/catalog/testing/catalog-fixtures';
import {
  C,
  dialog,
  edited,
  qasetIn,
  renderConcept as render,
  text,
} from './testing/render-concept';

const before = (a: Element, b: Element) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe('ConceptPage header', () => {
  it('names the notion by its base-language pair: the main question, small, above its answer', async () => {
    const { header } = await render();

    const question = header().querySelector('h1')!;
    expect(text(question)).toBe('Comment éviter le paludisme ?');
    expect(question.classList).toContain('base-question');
    expect(question.getAttribute('lang')).toBe('fr');
    const answer = header().querySelector('.base-answer')!;
    expect(text(answer)).toBe('Dormez chaque nuit sous une moustiquaire imprégnée d’insecticide.');
    expect(before(question, answer)).toBe(true);
    // Categories and intents keep their place, after the pair.
    expect(before(answer, header().querySelector('[data-kind="categories"]')!)).toBe(true);
  });

  it('lists every other project language under the base pair, in the project’s order', async () => {
    const { header } = await render();

    const rows = [...header().querySelectorAll<HTMLElement>('.translations > li')];
    expect(rows.map((row) => row.dataset['lang'])).toEqual(['bm', 'en', 'ff']);
    expect(before(header().querySelector('.base-answer')!, rows[0])).toBe(true);
    const en = rows[1];
    expect(text(en.querySelector('.language'))).toBe('English');
    expect(text(en.querySelector('.question'))).toBe('How can I avoid malaria?');
    expect(en.querySelector('.question')?.getAttribute('lang')).toBe('en');
  });

  it('gives each translated main question its own toolbar: edit, audio, translate, delete', async () => {
    const { header } = await render();

    const en = header().querySelector('.translations > li[data-lang="en"]')!;
    const bar = en.querySelector('[role="toolbar"]')!;
    expect(bar.getAttribute('aria-label')).toBe('Outils de la question principale (English)');
    expect([...bar.querySelectorAll('button')].map((b) => b.getAttribute('aria-label'))).toEqual([
      'Modifier la question principale (English)',
      'Gérer l’audio de la question principale (English)',
      'Traduire la question principale (English)',
      'Supprimer la question principale (English)',
    ]);
  });

  it('edits a translated main question in its modal, then re-fetches', async () => {
    const { api, header, click, inDialog, type, submit, afterFirstWrite } = await render();
    api.answers[C] = edited((d) => (qasetIn(d, IDS.en).variants[0].text = 'How to avoid malaria?'));

    await click('Modifier la question principale (English)', header());
    expect(text(document.getElementById(dialog()!.getAttribute('aria-labelledby')!))).toBe(
      'Modifier la question principale (English)',
    );
    type(inDialog<HTMLTextAreaElement>('textarea')!, 'How to avoid malaria?');
    await submit(inDialog<HTMLFormElement>('form')!);

    expect(afterFirstWrite()).toEqual([
      `PATCH /qasets/${IDS.qasetEn}/variants/${IDS.variantEn1}`,
      `GET ${C}`,
    ]);
    expect(text(header().querySelector('li[data-lang="en"] .question'))).toBe(
      'How to avoid malaria?',
    );
  });

  it('opens that question’s audio modal from its toolbar', async () => {
    const { header, click } = await render();

    await click('Gérer l’audio de la question principale (English)', header());

    expect(text(document.getElementById(dialog()!.getAttribute('aria-labelledby')!))).toBe(
      'Audio de la question principale (English)',
    );
  });

  it('shows a soft placeholder for a language without a translated question, with a way to translate it', async () => {
    const { header } = await render();

    for (const lang of ['bm', 'ff']) {
      const row = header().querySelector(`.translations > li[data-lang="${lang}"]`)!;
      expect(row.querySelector('.question')).toBeNull();
      expect(text(row.querySelector('.untranslated'))).toBe('Pas encore de traduction');
      expect(row.querySelector('[role="alert"], .field-error')).toBeNull();
    }
    expect(header().querySelector('li[data-lang="ff"] button')?.getAttribute('aria-label')).toBe(
      'Traduire la notion en Peul',
    );
  });

  it('translates the notion into a missing language from its placeholder', async () => {
    const { api, header, click, submit, inDialog, afterFirstWrite } = await render();

    await click('Traduire la notion en Peul', header());
    expect(text(document.getElementById(dialog()!.getAttribute('aria-labelledby')!))).toBe(
      'Traduire la notion en Peul',
    );
    await submit(inDialog<HTMLFormElement>('form')!);

    expect(api.writes).toEqual([
      {
        method: 'POST',
        path: `${C}/translate`,
        body: { target_language_id: IDS.ff, engine: 'llm' },
      },
    ]);
    expect(afterFirstWrite()).toEqual([`POST ${C}/translate`, `GET ${C}`]);
    expect(dialog()).toBeNull();
  });

  it('shows the translations but no tool to a reader', async () => {
    const { header } = await render({ me: ME_READER });

    expect(text(header().querySelector('li[data-lang="en"] .question'))).toBe(
      'How can I avoid malaria?',
    );
    expect(
      header().querySelector('.translations [role="toolbar"], .translations button'),
    ).toBeNull();
    expect(text(header().querySelector('li[data-lang="ff"]'))).toContain(
      'Pas encore de traduction',
    );
  });

  it('never mentions a missing audio, anywhere', async () => {
    const { element, click, section } = await render();

    expect(element.textContent).not.toMatch(/pas d’audio/i);
    expect(element.querySelector('.no-audio')).toBeNull();
    await click('Gérer l’audio de la variante 2', section('fr'));
    expect(dialog()!.textContent).not.toMatch(/pas d’audio/i);
  });
});
