import { IDS, ME_READER } from '../../core/catalog/testing/catalog-fixtures';
import {
  C,
  dialog,
  edited,
  escape,
  qasetIn,
  renderConcept as render,
  text,
} from './testing/render-concept';

const before = (a: Element, b: Element) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
const names = (scope: Element | null) =>
  [...(scope?.querySelectorAll('button') ?? [])].map((b) => b.getAttribute('aria-label'));
const titleOf = (open: HTMLElement) =>
  text(document.getElementById(open.getAttribute('aria-labelledby')!));
const key = (target: Element, name: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));

describe('ConceptPage card', () => {
  it('gathers every language in a single card: no card per language', async () => {
    const { element, card } = await render();

    expect(element.querySelectorAll('section.concept-card')).toHaveLength(1);
    expect(element.querySelector('section.language')).toBeNull();
    expect(card().querySelector('.pairs')).not.toBeNull();
    expect(card().querySelector('[role="tablist"]')).not.toBeNull();
  });

  it('titles the card with the base language only, and the page with its main question only', async () => {
    const { card, header } = await render();

    const title = card().querySelector('h2')!;
    expect(text(title)).toMatch(/^Français/);
    expect(text(title.querySelector('.base'))).toBe('Langue de base');
    expect(text(title)).not.toMatch(/English|Bambara|Peul/);
    const h1 = header().querySelector('h1')!;
    expect(text(h1)).toBe('Comment éviter le paludisme ?');
    expect(h1.getAttribute('lang')).toBe('fr');
    expect(text(header())).not.toContain('How can I avoid malaria?');
  });

  it('pairs each language’s main question with its answer: the base first, then the project’s order', async () => {
    const { card, pair } = await render();

    const rows = [...card().querySelectorAll<HTMLElement>('.pairs > li')];
    expect(rows.map((row) => row.dataset['lang'])).toEqual(['fr', 'bm', 'en', 'ff']);
    expect(rows[0].classList).toContain('base-pair');
    const question = pair('fr').querySelector('app-variant-item .text')!;
    const answer = pair('fr').querySelector('.answer .text')!;
    expect(text(question)).toBe('Comment éviter le paludisme ?');
    expect(text(answer)).toBe('Dormez chaque nuit sous une moustiquaire imprégnée d’insecticide.');
    expect(before(question, answer)).toBe(true);
    expect(text(pair('en').querySelector('.language'))).toBe('English');
    expect(text(pair('en').querySelector('app-variant-item .text'))).toBe(
      'How can I avoid malaria?',
    );
    expect(pair('en').querySelector('app-variant-item .text')?.getAttribute('lang')).toBe('en');
    expect(pair('en').querySelector('.answer .text')?.getAttribute('lang')).toBe('en');
  });

  it('puts each question’s and each answer’s toolbar on its own line', async () => {
    const { pair } = await render();

    for (const [code, language] of [
      ['fr', 'Français'],
      ['en', 'English'],
    ]) {
      const question = pair(code).querySelector('app-variant-item .line')!;
      expect(question.querySelector('.text')).not.toBeNull();
      expect(names(question.querySelector('[role="toolbar"]'))).toEqual([
        `Modifier la question principale (${language})`,
        `Gérer l’audio de la question principale (${language})`,
        `Traduire la question principale (${language})`,
        `Supprimer la question principale (${language})`,
      ]);
      const answer = pair(code).querySelector('.answer .line')!;
      expect(answer.querySelector('.text')).not.toBeNull();
      const bar = answer.querySelector('[role="toolbar"]')!;
      expect(bar.getAttribute('aria-label')).toBe(`Outils de la réponse (${language})`);
      expect(names(bar)).toEqual([
        `Modifier la réponse (${language})`,
        `Gérer l’audio de la réponse (${language})`,
      ]);
    }
  });

  it('shows the soft placeholder where a language has no question yet, with a way to translate', async () => {
    const { pair } = await render();

    for (const code of ['bm', 'ff']) {
      expect(pair(code).querySelector('app-variant-item')).toBeNull();
      expect(text(pair(code).querySelector('.untranslated'))).toBe('Pas encore de traduction');
      expect(pair(code).querySelector('[role="alert"], .field-error')).toBeNull();
    }
    expect(names(pair('ff'))).toEqual(['Traduire la notion en Peul']);
    // Bambara has its QASet already: its answer stays, under the placeholder.
    expect(text(pair('bm').querySelector('.answer .text'))).not.toBe('');
    expect(pair('ff').querySelector('.answer')).toBeNull();
  });

  it('edits a translated main question in its modal, then re-fetches', async () => {
    const { api, pair, click, inDialog, type, submit, afterFirstWrite } = await render();
    api.answers[C] = edited((d) => (qasetIn(d, IDS.en).variants[0].text = 'How to avoid malaria?'));

    await click('Modifier la question principale (English)', pair('en'));
    expect(titleOf(dialog()!)).toBe('Modifier la question principale (English)');
    type(inDialog<HTMLTextAreaElement>('textarea')!, 'How to avoid malaria?');
    await submit(inDialog<HTMLFormElement>('form')!);

    expect(afterFirstWrite()).toEqual([
      `PATCH /qasets/${IDS.qasetEn}/variants/${IDS.variantEn1}`,
      `GET ${C}`,
    ]);
    expect(text(pair('en').querySelector('app-variant-item .text'))).toBe('How to avoid malaria?');
  });

  it('opens a main question’s and an answer’s audio modals from their toolbars', async () => {
    const { pair, click, settle } = await render();

    await click('Gérer l’audio de la question principale (English)', pair('en'));
    expect(titleOf(dialog()!)).toBe('Audio de la question principale (English)');
    escape();
    await settle();
    await click('Gérer l’audio de la réponse (English)', pair('en'));
    expect(titleOf(dialog()!)).toBe('Audio de la réponse (English)');
  });

  it('translates the notion into a missing language from its placeholder', async () => {
    const { api, pair, click, submit, inDialog, afterFirstWrite } = await render();

    await click('Traduire la notion en Peul', pair('ff'));
    expect(titleOf(dialog()!)).toBe('Traduire la notion en Peul');
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

  it('shows the pairs but no tool to a reader', async () => {
    const { card, pair } = await render({ me: ME_READER });

    expect(text(pair('en').querySelector('app-variant-item .text'))).toBe(
      'How can I avoid malaria?',
    );
    expect(card().querySelector('.pairs [role="toolbar"]')).toBeNull();
    expect(names(card().querySelector('.pairs'))).toEqual([
      'Écouter la question principale, voix Awa (0:03)',
      'Écouter la réponse, voix Awa (1:05)',
      'Écouter la réponse, voix Moussa (1:01)',
      'Écouter la réponse, voix Awa (1:10)',
    ]);
    expect(text(pair('ff'))).toContain('Pas encore de traduction');
  });

  it('never mentions a missing audio, anywhere', async () => {
    const { element, click, panel } = await render();

    expect(element.textContent).not.toMatch(/pas d’audio/i);
    expect(element.querySelector('.no-audio')).toBeNull();
    await click('Gérer l’audio de la variante 2', panel('fr'));
    expect(dialog()!.textContent).not.toMatch(/pas d’audio/i);
  });

  describe('variant tabs', () => {
    it('has one tab per project language, in the project’s order, the base one selected', async () => {
      const { card, tab, panel } = await render();

      const list = card().querySelector('[role="tablist"]')!;
      expect(list.getAttribute('aria-label')).toBe('Variantes par langue');
      expect(before(card().querySelector('.pairs')!, list)).toBe(true);
      const tabs = [...list.querySelectorAll('[role="tab"]')];
      expect(tabs.map((t) => text(t))).toEqual(['Français', 'Bambara', 'English', 'Peul']);
      expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual([
        'true',
        'false',
        'false',
        'false',
      ]);
      expect(tabs.map((t) => t.getAttribute('tabindex'))).toEqual(['0', '-1', '-1', '-1']);
      for (const code of ['fr', 'bm', 'en', 'ff']) {
        expect(tab(code).getAttribute('aria-controls')).toBe(panel(code).id);
        expect(panel(code).getAttribute('aria-labelledby')).toBe(tab(code).id);
        expect(panel(code).hidden).toBe(code !== 'fr');
      }
    });

    it('lists a language’s paraphrases in its tab, from variant 2, with their tools', async () => {
      const { panel } = await render();

      const fr = panel('fr');
      expect([...fr.querySelectorAll('ol.variants .variant .text')].map((v) => text(v))).toEqual([
        'Faut-il dormir sous une moustiquaire ?',
        'Que faire contre les moustiques la nuit ?',
      ]);
      expect(fr.querySelector('ol.variants')?.getAttribute('start')).toBe('2');
      expect(names(fr.querySelector('.variant [role="toolbar"]'))).toEqual([
        'Modifier la variante 2',
        'Gérer l’audio de la variante 2',
        'Traduire la variante 2',
        'Supprimer la variante 2',
      ]);
      // The main question is in the pair, not repeated in the tab.
      expect(text(fr)).not.toContain('Comment éviter le paludisme ?');
      expect(text(panel('en'))).toContain('Aucune autre variante.');
      expect(text(panel('bm'))).toContain('Aucune variante dans cette langue.');
    });

    it('adds and generates variants from inside each translated language’s tab', async () => {
      const { panel, button } = await render();

      for (const code of ['fr', 'bm', 'en']) {
        expect(() => button('Ajouter une variante', panel(code))).not.toThrow();
        expect(() => button('Générer des variantes', panel(code))).not.toThrow();
      }
      expect(panel('ff').querySelector('app-qaset-section')).toBeNull();
    });

    it('shows the placeholder, with « Traduire », in an untranslated language’s tab', async () => {
      const { api, panel, select, click, submit, inDialog } = await render();

      await select('ff');
      expect(text(panel('ff').querySelector('.untranslated'))).toBe('Pas encore de traduction');
      expect(panel('ff').querySelector('ol.variants')).toBeNull();
      await click('Traduire la notion en Peul', panel('ff'));
      await submit(inDialog<HTMLFormElement>('form')!);

      expect(api.writes.map((w) => `${w.method} ${w.path}`)).toEqual([`POST ${C}/translate`]);
    });

    it('switches tab on a click, showing only that language’s panel', async () => {
      const { tab, panel, select } = await render();

      await select('en');

      expect(tab('en').getAttribute('aria-selected')).toBe('true');
      expect(tab('fr').getAttribute('aria-selected')).toBe('false');
      expect(panel('en').hidden).toBe(false);
      expect(panel('fr').hidden).toBe(true);
    });

    it('moves between tabs with the arrows, Home and End, selecting as it goes', async () => {
      const { tab, settle } = await render();
      const selected = () => document.querySelector('[role="tab"][aria-selected="true"]');

      tab('fr').focus();
      key(tab('fr'), 'ArrowRight');
      await settle();
      expect(selected()).toBe(tab('bm'));
      expect(document.activeElement).toBe(tab('bm'));
      expect(tab('bm').getAttribute('tabindex')).toBe('0');
      expect(tab('fr').getAttribute('tabindex')).toBe('-1');
      key(tab('bm'), 'End');
      await settle();
      expect(document.activeElement).toBe(tab('ff'));
      key(tab('ff'), 'ArrowRight');
      await settle();
      expect(document.activeElement).toBe(tab('fr'));
      key(tab('fr'), 'ArrowLeft');
      await settle();
      expect(selected()).toBe(tab('ff'));
      key(tab('ff'), 'Home');
      await settle();
      expect(document.activeElement).toBe(tab('fr'));
      expect(selected()).toBe(tab('fr'));
    });

    it('remembers the selected tab across a re-fetch', async () => {
      const { api, tab, pair, select, click, inDialog, type, submit } = await render();
      api.answers[C] = edited((d) => (qasetIn(d, IDS.en).answer.text = 'Sleep under a net.'));

      await select('en');
      await click('Modifier la réponse (English)', pair('en'));
      type(inDialog<HTMLTextAreaElement>('textarea')!, 'Sleep under a net.');
      await submit(inDialog<HTMLFormElement>('form')!);

      expect(text(pair('en').querySelector('.answer .text'))).toBe('Sleep under a net.');
      expect(tab('en').getAttribute('aria-selected')).toBe('true');
    });
  });
});
