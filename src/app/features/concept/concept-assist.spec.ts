import { engineError } from '../../core/api/testing/fake-api-port';
import { CONCEPT, IDS, ME_READER } from '../../core/catalog/testing/catalog-fixtures';
import { C, renderConcept as render, text } from './testing/render-concept';

const FR = `/qasets/${IDS.qasetFr}`;
const GENERATE = `POST ${FR}/generate-variants`;
const ADD_FR_VARIANT = `POST ${FR}/variants`;
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

    it('offers every project language but the base one — absent ones are created, present ones updated', async () => {
      const { element, click } = await render();

      await click('Traduire la notion');

      expect(options(panel(element).querySelector('select')!)).toEqual([
        'Bambara',
        'English',
        'Peul',
      ]);
      expect(text(panel(element))).toContain('Une langue déjà présente est mise à jour');
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
    it('offers only the other languages the concept already has a QASet in', async () => {
      const { section, click } = await render();

      await click('Traduire la variante 1', section('fr'));

      expect(options(section('fr').querySelector('.variant .translate select')!)).toEqual([
        'English',
        'Bambara',
      ]);
    });

    it('translates a variant into that language’s QASet, then re-fetches', async () => {
      const { api, section, click, type, submit, afterFirstWrite } = await render();

      await click('Traduire la variante 1', section('fr'));
      type(section('fr').querySelector('.variant .translate select')!, IDS.bm);
      await submit(section('fr').querySelector('.variant .translate form')!);

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
        const { section, click, type, submit, afterFirstWrite } = await render({
          answers: { [path]: engineError(status, code) },
        });

        await click('Traduire la variante 1', section('fr'));
        type(section('fr').querySelector('.variant .translate select')!, IDS.en);
        await submit(section('fr').querySelector('.variant .translate form')!);

        expect(text(section('fr').querySelector('.variant .translate [role="alert"]'))).toBe(
          message,
        );
        expect(afterFirstWrite()).toEqual([path]);
        expect(section('en').querySelectorAll('.variant')).toHaveLength(1);
        expect(section('fr').querySelector('.variant .translate form')).not.toBeNull();
      });
    }
  });

  describe('variant generation', () => {
    async function generate(
      candidates: string[] = ['Comment se protéger ?', 'Que faire la nuit ?', 'Et les enfants ?'],
    ) {
      const page = await render({ answers: { [GENERATE]: { candidates } } });
      await page.click('Générer des variantes', page.section('fr'));
      page.type(page.section('fr').querySelector('.generate textarea')!, 'Pour les mères');
      await page.submit(page.section('fr').querySelector('.generate form')!);
      const list = () => page.section('fr').querySelector('.candidates')!;
      const fields = () => [...list().querySelectorAll<HTMLTextAreaElement>('textarea')];
      const keeps = () => [...list().querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
      return { ...page, list, fields, keeps };
    }

    it('asks the QASet with the optional context and lists the candidates, all kept, nothing saved', async () => {
      const { api, fields, keeps, afterFirstWrite } = await generate();

      expect(api.writes).toEqual([
        { method: 'POST', path: `${FR}/generate-variants`, body: { context: 'Pour les mères' } },
      ]);
      expect(fields().map((f) => f.value)).toEqual([
        'Comment se protéger ?',
        'Que faire la nuit ?',
        'Et les enfants ?',
      ]);
      expect(keeps().map((k) => k.checked)).toEqual([true, true, true]);
      expect(afterFirstWrite()).toEqual([GENERATE]);
    });

    it('generates in each QASet’s own language', async () => {
      const page = await render({
        answers: {
          [`POST /qasets/${IDS.qasetEn}/generate-variants`]: { candidates: ['Why a net?'] },
        },
      });

      await page.click('Générer des variantes', page.section('en'));
      await page.submit(page.section('en').querySelector('.generate form')!);

      expect(page.api.writes.map((w) => w.path)).toEqual([
        `/qasets/${IDS.qasetEn}/generate-variants`,
      ]);
      expect(page.section('en').querySelector('.candidates textarea')?.getAttribute('lang')).toBe(
        'en',
      );
    });

    it('adds only the kept candidates, as edited, one call each in order, then re-fetches once', async () => {
      const { api, section, click, type, toggle, fields, keeps, afterFirstWrite } =
        await generate();

      toggle(keeps()[1]);
      type(fields()[2], 'Et pour les enfants de moins de 5 ans ?');
      await click('Ajouter les retenues (2)', section('fr'));

      expect(api.writes.slice(1)).toEqual([
        { method: 'POST', path: `${FR}/variants`, body: { text: 'Comment se protéger ?' } },
        {
          method: 'POST',
          path: `${FR}/variants`,
          body: { text: 'Et pour les enfants de moins de 5 ans ?' },
        },
      ]);
      expect(afterFirstWrite()).toEqual([GENERATE, ADD_FR_VARIANT, ADD_FR_VARIANT, `GET ${C}`]);
      expect(section('fr').querySelector('.generate')).toBeNull();
    });

    it('says so when the generation engine fails', async () => {
      const page = await render({
        answers: { [GENERATE]: engineError(502, 'generation_engine_error') },
      });

      await page.click('Générer des variantes', page.section('fr'));
      await page.submit(page.section('fr').querySelector('.generate form')!);

      expect(text(page.section('fr').querySelector('.generate [role="alert"]'))).toBe(
        'La génération a échoué : aucune variante n’a été proposée. Réessayez.',
      );
      expect(page.section('fr').querySelector('.candidates')).toBeNull();
    });

    it('stops at a failed add, keeps what was added, and lets the re-fetch reconcile', async () => {
      const { api, section, click, list, fields, afterFirstWrite } = await generate();
      api.answers[ADD_FR_VARIANT] = (body: { text: string }) =>
        body.text === 'Que faire la nuit ?' ? engineError(422, 'invalid_text') : {};

      await click('Ajouter les retenues (3)', section('fr'));

      expect(afterFirstWrite()).toEqual([GENERATE, ADD_FR_VARIANT, ADD_FR_VARIANT, `GET ${C}`]);
      expect(text(list().querySelector('[role="alert"]'))).toBe(
        'Le texte a été refusé : il ne peut pas être vide.',
      );
      expect(fields().map((f) => f.value)).toEqual(['Que faire la nuit ?', 'Et les enfants ?']);
    });

    it('drops the candidates on cancel without saving anything', async () => {
      const { api, section, click } = await generate();

      await click('Abandonner les propositions', section('fr'));

      expect(api.writes).toHaveLength(1);
      expect(section('fr').querySelector('.candidates')).toBeNull();
    });
  });
});
