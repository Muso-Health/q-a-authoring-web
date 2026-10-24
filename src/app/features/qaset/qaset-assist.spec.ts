import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { Schemas } from '../../core/api/api-types';
import { ApiPort } from '../../core/api/api-port';
import { FakeApiPort, engineError } from '../../core/api/testing/fake-api-port';
import {
  IDS,
  ME_AUTHOR,
  ME_READER,
  QASET,
  world,
} from '../../core/catalog/testing/catalog-fixtures';
import { provideTestI18n } from '../../core/i18n/testing/provide-test-i18n';
import { QASetPage } from './qaset-page';

const Q = `/qasets/${IDS.qaset}`;
const GENERATE = `POST ${Q}/answers/${IDS.answerFr}/generate-variants`;
const ADD_FR_VARIANT = `POST ${Q}/languages/${IDS.fr}/variants`;
const text = (element: Element | null | undefined) =>
  element?.textContent?.replace(/\s+/g, ' ').trim();

async function render(
  me: Schemas['MeResponse'] = ME_AUTHOR,
  overrides: Record<string, unknown> = {},
) {
  const api = new FakeApiPort({ ...world(), '/me': me, ...overrides });
  TestBed.configureTestingModule({
    imports: [QASetPage],
    providers: [provideTestI18n(), provideRouter([]), { provide: ApiPort, useValue: api }],
  });
  const fixture = TestBed.createComponent(QASetPage);
  fixture.componentRef.setInput('qasetId', IDS.qaset);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const settle = () => fixture.whenStable();

  const section = (code: string) =>
    element.querySelector<HTMLElement>(`section.language[data-lang="${code}"]`)!;
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
  const set = (
    field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
    value: string,
  ) => {
    field.value = value;
    field.dispatchEvent(new Event('input'));
    field.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };
  const toggle = (box: HTMLInputElement) => {
    box.click();
    fixture.detectChanges();
  };
  const submit = async (form: HTMLFormElement) => {
    form.dispatchEvent(new Event('submit'));
    await settle();
  };
  const afterFirstWrite = () =>
    api.calls.slice(api.calls.findIndex((call) => !call.startsWith('GET')));
  return { api, element, section, buttonNamed, click, set, toggle, submit, afterFirstWrite };
}

const options = (select: HTMLSelectElement) =>
  [...select.options].filter((o) => o.value !== '').map((o) => text(o));

describe('QASetPage engine assistance', () => {
  it('offers neither translation nor generation without author_qasets', async () => {
    const { element, buttonNamed } = await render(ME_READER);

    expect(buttonNamed('Traduire la réponse', element)).toBeUndefined();
    expect(buttonNamed('Traduire la variante 1', element)).toBeUndefined();
    expect(buttonNamed('Générer des variantes', element)).toBeUndefined();
  });

  describe('translation', () => {
    it('offers an answer only the languages that have no answer yet', async () => {
      const { section, click } = await render();

      await click('Traduire la réponse', section('fr'));

      expect(options(section('fr').querySelector('.translate select')!)).toEqual(['Peul']);
    });

    it('offers a variant only the other languages that already have an answer', async () => {
      const { section, click } = await render();

      await click('Traduire la variante 1', section('fr'));

      expect(options(section('fr').querySelector('.variant .translate select')!)).toEqual([
        'English',
        'Bambara',
      ]);
    });

    it('lets the author choose the engine, LLM by default', async () => {
      const { section, click } = await render();

      await click('Traduire la réponse', section('fr'));

      const engines = [
        ...section('fr').querySelectorAll<HTMLInputElement>('.translate input[type="radio"]'),
      ];
      expect(engines.map((r) => [r.value, r.checked])).toEqual([
        ['llm', true],
        ['google', false],
      ]);
      expect(text(section('fr').querySelector('.translate legend'))).toBe('Moteur de traduction');
    });

    it('translates an answer with the chosen engine, then re-fetches', async () => {
      const { api, section, click, set, toggle, submit, afterFirstWrite } = await render();

      await click('Traduire la réponse', section('fr'));
      set(section('fr').querySelector('.translate select')!, IDS.ff);
      toggle(section('fr').querySelector<HTMLInputElement>('.translate input[value="google"]')!);
      await submit(section('fr').querySelector('.translate form')!);

      expect(api.writes).toEqual([
        {
          method: 'POST',
          path: `${Q}/answers/${IDS.answerFr}/translate`,
          body: { target_language_id: IDS.ff, engine: 'google' },
        },
      ]);
      expect(afterFirstWrite()).toEqual([
        `POST ${Q}/answers/${IDS.answerFr}/translate`,
        `GET ${Q}`,
      ]);
      expect(section('fr').querySelector('.translate')).toBeNull();
    });

    it('translates a variant, then re-fetches', async () => {
      const { api, section, click, set, submit, afterFirstWrite } = await render();

      await click('Traduire la variante 1', section('fr'));
      set(section('fr').querySelector('.variant .translate select')!, IDS.bm);
      await submit(section('fr').querySelector('.variant .translate form')!);

      expect(api.writes).toEqual([
        {
          method: 'POST',
          path: `${Q}/variants/${IDS.variantFr1}/translate`,
          body: { target_language_id: IDS.bm, engine: 'llm' },
        },
      ]);
      expect(afterFirstWrite()).toEqual([
        `POST ${Q}/variants/${IDS.variantFr1}/translate`,
        `GET ${Q}`,
      ]);
    });

    it('does not offer to translate an answer when every language already has one', async () => {
      const everyLanguage = structuredClone(QASET);
      everyLanguage.languages.push({
        language_id: IDS.ff,
        variant_count: 0,
        variants: [],
        answer: {
          id: 'answer-ff',
          text: 'Hoyre.',
          links: [],
          audio: null,
          translation_validation: null,
        },
      });
      const { section, buttonNamed } = await render(ME_AUTHOR, { [Q]: everyLanguage });

      expect(buttonNamed('Traduire la réponse', section('fr'))).toBeUndefined();
      expect(buttonNamed('Traduire la variante 1', section('fr'))).toBeDefined();
    });

    const refusals: [number, string, string][] = [
      [409, 'language_already_present', 'Cette langue a déjà une réponse dans cet ensemble.'],
      [
        409,
        'language_presence_required',
        'Cette langue n’a pas encore de réponse dans cet ensemble : ajoutez-la d’abord.',
      ],
      [422, 'same_language', 'Les deux langues sont identiques : choisissez-en une autre.'],
      [422, 'unknown_language', 'Cette langue n’est pas enregistrée dans le moteur.'],
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
        const { api, section, click, set, submit, afterFirstWrite } = await render();
        api.answers[`POST ${Q}/variants/${IDS.variantFr1}/translate`] = engineError(status, code);

        await click('Traduire la variante 1', section('fr'));
        set(section('fr').querySelector('.variant .translate select')!, IDS.en);
        await submit(section('fr').querySelector('.variant .translate form')!);

        expect(text(section('fr').querySelector('.variant .translate [role="alert"]'))).toBe(
          message,
        );
        expect(afterFirstWrite()).toEqual([`POST ${Q}/variants/${IDS.variantFr1}/translate`]);
        expect(section('en').querySelectorAll('.variant')).toHaveLength(1);
        expect(section('fr').querySelector('.variant .translate form')).not.toBeNull();
      });
    }
  });

  describe('variant generation', () => {
    async function generate(
      candidates: string[] = ['Comment se protéger ?', 'Que faire la nuit ?', 'Et les enfants ?'],
    ) {
      const page = await render();
      page.api.answers[GENERATE] = { candidates };
      await page.click('Générer des variantes', page.section('fr'));
      page.set(page.section('fr').querySelector('.generate textarea')!, 'Pour les mères');
      await page.submit(page.section('fr').querySelector('.generate form')!);
      const list = () => page.section('fr').querySelector('.candidates')!;
      const fields = () => [...list().querySelectorAll<HTMLTextAreaElement>('textarea')];
      const keeps = () => [...list().querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
      return { ...page, list, fields, keeps };
    }

    it('asks with the optional context and lists the candidates, all kept, nothing saved', async () => {
      const { api, fields, keeps, afterFirstWrite } = await generate();

      expect(api.writes).toEqual([
        {
          method: 'POST',
          path: `${Q}/answers/${IDS.answerFr}/generate-variants`,
          body: { context: 'Pour les mères' },
        },
      ]);
      expect(fields().map((f) => f.value)).toEqual([
        'Comment se protéger ?',
        'Que faire la nuit ?',
        'Et les enfants ?',
      ]);
      expect(keeps().map((k) => k.checked)).toEqual([true, true, true]);
      expect(afterFirstWrite()).toEqual([GENERATE]);
    });

    it('adds only the kept candidates, as edited, one call each in order, then re-fetches once', async () => {
      const { api, section, click, set, toggle, fields, keeps, afterFirstWrite } = await generate();

      toggle(keeps()[1]);
      set(fields()[2], 'Et pour les enfants de moins de 5 ans ?');
      await click('Ajouter les retenues (2)', section('fr'));

      expect(api.writes.slice(1)).toEqual([
        {
          method: 'POST',
          path: `${Q}/languages/${IDS.fr}/variants`,
          body: { text: 'Comment se protéger ?' },
        },
        {
          method: 'POST',
          path: `${Q}/languages/${IDS.fr}/variants`,
          body: { text: 'Et pour les enfants de moins de 5 ans ?' },
        },
      ]);
      expect(afterFirstWrite()).toEqual([GENERATE, ADD_FR_VARIANT, ADD_FR_VARIANT, `GET ${Q}`]);
      expect(section('fr').querySelector('.generate')).toBeNull();
    });

    it('says so when the generation engine fails', async () => {
      const page = await render();
      page.api.answers[GENERATE] = engineError(502, 'generation_engine_error');

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

      expect(afterFirstWrite()).toEqual([GENERATE, ADD_FR_VARIANT, ADD_FR_VARIANT, `GET ${Q}`]);
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
