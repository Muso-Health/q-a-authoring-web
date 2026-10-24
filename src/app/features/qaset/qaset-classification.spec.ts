import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { Schemas } from '../../core/api/api-types';
import { ApiPort } from '../../core/api/api-port';
import { FakeApiPort, engineError } from '../../core/api/testing/fake-api-port';
import { IDS, ME_AUTHOR, ME_READER, world } from '../../core/catalog/testing/catalog-fixtures';
import { provideTestI18n } from '../../core/i18n/testing/provide-test-i18n';
import { QASetPage } from './qaset-page';

const Q = `/qasets/${IDS.qaset}`;
const ME_CURATOR: Schemas['MeResponse'] = {
  ...ME_AUTHOR,
  permissions: ['author_qasets', 'manage_intents', 'manage_categories'],
};
const text = (element: Element | null | undefined) =>
  element?.textContent?.replace(/\s+/g, ' ').trim();

async function render(me: Schemas['MeResponse'] = ME_CURATOR) {
  const api = new FakeApiPort({
    ...world(),
    '/me': me,
    '/intents?q=mous': {
      items: [
        { id: 'i2', text: 'moustiquaire' },
        { id: 'i5', text: 'moustique' },
      ],
    },
    '/intents?q=fi%C3%A8vre': { items: [] },
    '/categories?q=enf': { items: [{ id: 'c2', name: 'Enfants de moins de 5 ans' }] },
    '/categories?q=urg': { items: [{ id: 'c7', name: 'Urgences' }] },
    '/categories?q=nutrition': { items: [] },
    'POST /intents': { id: 'i9', text: 'fièvre' },
    'POST /categories': { id: 'c9', name: 'nutrition' },
  });
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
  const variant = (code: string, n: number) =>
    section(code).querySelectorAll<HTMLElement>('.variant')[n - 1];
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
  const type = async (scope: ParentNode, value: string) => {
    const input = scope.querySelector<HTMLInputElement>('input[role="combobox"]')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  };
  const choose = async (scope: ParentNode, label: string) => {
    const option = [...scope.querySelectorAll<HTMLElement>('[role="option"]')].find(
      (o) => text(o) === label,
    );
    if (!option) throw new Error(`no option "${label}"`);
    option.click();
    await settle();
  };
  const options = (scope: ParentNode) =>
    [...scope.querySelectorAll('[role="option"]')].map((o) => text(o));
  const select = (field: HTMLSelectElement, value: string) => {
    field.value = value;
    field.dispatchEvent(new Event('input'));
    field.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };
  const submit = async (form: HTMLFormElement) => {
    form.dispatchEvent(new Event('submit'));
    await settle();
  };
  const afterFirstWrite = () =>
    api.calls.slice(api.calls.findIndex((call) => !call.startsWith('GET')));
  const chips = (scope: ParentNode) =>
    [...scope.querySelectorAll('.muso-chips .chip-label')].map((c) => text(c));
  return {
    api,
    element,
    section,
    variant,
    buttonNamed,
    click,
    type,
    choose,
    options,
    select,
    submit,
    afterFirstWrite,
    chips,
  };
}

describe('QASetPage classification and links', () => {
  it('offers no classification or linking without author_qasets', async () => {
    const { element, buttonNamed } = await render(ME_READER);

    for (const name of [
      'Ajouter une intention à la variante 1',
      'Ajouter une catégorie',
      'Lier une traduction',
      'Retirer l’intention « moustiquaire »',
      'Retirer la catégorie « Prévention »',
      'Délier la traduction (English)',
    ]) {
      expect(buttonNamed(name, element)).toBeUndefined();
    }
  });

  describe('intents', () => {
    it('searches by prefix and attaches an existing intent, leaving out those already attached', async () => {
      const { api, variant, click, type, options, choose, afterFirstWrite } = await render();

      await click('Ajouter une intention à la variante 2', variant('fr', 2));
      await type(variant('fr', 2), 'mous');

      expect(api.reads).toContain('/intents?q=mous');
      // Variant 2 already carries « moustiquaire ».
      expect(options(variant('fr', 2))).toEqual(['moustique', 'Créer « mous »']);
      await choose(variant('fr', 2), 'moustique');

      expect(afterFirstWrite()).toEqual([
        `POST ${Q}/variants/${IDS.variantFr2}/intents`,
        `GET ${Q}`,
      ]);
      expect(api.writes[0].body).toEqual({ intent_id: 'i5' });
      expect(variant('fr', 2).querySelector('input[role="combobox"]')).toBeNull();
    });

    it('creates a missing intent, then attaches it, then re-fetches', async () => {
      const { api, variant, click, type, choose, afterFirstWrite } = await render();

      await click('Ajouter une intention à la variante 3', variant('fr', 3));
      await type(variant('fr', 3), 'fièvre');
      await choose(variant('fr', 3), 'Créer « fièvre »');

      expect(api.writes).toEqual([
        { method: 'POST', path: '/intents', body: { text: 'fièvre' } },
        {
          method: 'POST',
          path: `${Q}/variants/${IDS.variantFr3}/intents`,
          body: { intent_id: 'i9' },
        },
      ]);
      expect(afterFirstWrite()).toEqual([
        'POST /intents',
        `POST ${Q}/variants/${IDS.variantFr3}/intents`,
        `GET ${Q}`,
      ]);
    });

    it('offers to create only with manage_intents', async () => {
      const { variant, click, type, options } = await render(ME_AUTHOR);

      await click('Ajouter une intention à la variante 3', variant('fr', 3));
      await type(variant('fr', 3), 'fièvre');

      expect(options(variant('fr', 3))).toEqual([]);
    });

    it('detaches an intent from its chip, then re-fetches', async () => {
      const { variant, chips, click, afterFirstWrite } = await render();

      expect(chips(variant('fr', 1))).toEqual(['prévention_paludisme', 'moustiquaire']);
      await click('Retirer l’intention « moustiquaire »', variant('fr', 1));

      expect(afterFirstWrite()).toEqual([
        `DELETE ${Q}/variants/${IDS.variantFr1}/intents/i2`,
        `GET ${Q}`,
      ]);
    });
  });

  describe('categories', () => {
    it('attaches an existing category to the QASet, leaving out those already attached', async () => {
      const { api, element, click, type, options, choose, afterFirstWrite } = await render();
      const header = element.querySelector('header')!;

      await click('Ajouter une catégorie', header);
      await type(header, 'enf');
      // « Enfants de moins de 5 ans » is already on the set; only a new « enf » could be made.
      expect(options(header)).toEqual(['Créer « enf »']);
      await type(header, 'urg');
      expect(options(header)).toEqual(['Urgences', 'Créer « urg »']);
      await choose(header, 'Urgences');

      expect(api.writes).toEqual([
        { method: 'POST', path: `${Q}/categories`, body: { category_id: 'c7' } },
      ]);
      expect(afterFirstWrite()).toEqual([`POST ${Q}/categories`, `GET ${Q}`]);
    });

    it('creates a missing category, then attaches it', async () => {
      const { api, element, click, type, choose } = await render();
      const header = element.querySelector('header')!;

      await click('Ajouter une catégorie', header);
      await type(header, 'nutrition');
      await choose(header, 'Créer « nutrition »');

      expect(api.writes).toEqual([
        { method: 'POST', path: '/categories', body: { name: 'nutrition' } },
        { method: 'POST', path: `${Q}/categories`, body: { category_id: 'c9' } },
      ]);
    });

    it('removes a category from its chip, then re-fetches', async () => {
      const { element, click, afterFirstWrite } = await render();

      await click('Retirer la catégorie « Prévention »', element.querySelector('header')!);

      expect(afterFirstWrite()).toEqual([`DELETE ${Q}/categories/c1`, `GET ${Q}`]);
    });
  });

  describe('manual translation links', () => {
    const picker = (scope: HTMLElement) =>
      scope.querySelector<HTMLSelectElement>('.link-form select')!;
    const candidates = (scope: HTMLElement) =>
      [...picker(scope).options].filter((o) => o.value !== '').map((o) => text(o));

    it('offers an answer the other answers it is not linked to, with their text and language', async () => {
      const { section, click } = await render();
      const answer = section('fr').querySelector<HTMLElement>('.answer')!;

      await click('Lier une traduction', answer);

      expect(candidates(answer)).toEqual(['Bambara — Su o su, i ka da sɔsɔ-finiw kɔrɔ.']);
    });

    it('offers a variant only the variants of other languages it is not linked to', async () => {
      const { variant, click, buttonNamed } = await render();

      // Variant 1 is linked to the only English variant: nothing is left to offer.
      expect(buttonNamed('Lier une traduction', variant('fr', 1))).toBeUndefined();
      await click('Lier une traduction', variant('en', 1));
      expect(candidates(variant('en', 1))).toEqual([
        'Français — Faut-il dormir sous une moustiquaire ?',
        'Français — Que faire contre les moustiques la nuit ?',
      ]);
    });

    it('links two answers, then re-fetches', async () => {
      const { api, section, click, select, submit, afterFirstWrite } = await render();
      const answer = section('fr').querySelector<HTMLElement>('.answer')!;

      await click('Lier une traduction', answer);
      select(picker(answer), IDS.answerBm);
      await submit(answer.querySelector<HTMLFormElement>('.link-form form')!);

      expect(api.writes).toEqual([
        {
          method: 'POST',
          path: `${Q}/answer-links`,
          body: { answer_a_id: IDS.answerFr, answer_b_id: IDS.answerBm },
        },
      ]);
      expect(afterFirstWrite()).toEqual([`POST ${Q}/answer-links`, `GET ${Q}`]);
    });

    it('links two variants, then re-fetches', async () => {
      const { api, variant, click, select, submit, afterFirstWrite } = await render();

      await click('Lier une traduction', variant('fr', 2));
      select(picker(variant('fr', 2)), IDS.variantEn1);
      await submit(variant('fr', 2).querySelector<HTMLFormElement>('.link-form form')!);

      expect(api.writes[0]).toEqual({
        method: 'POST',
        path: `${Q}/variant-links`,
        body: { variant_a_id: IDS.variantFr2, variant_b_id: IDS.variantEn1 },
      });
      expect(afterFirstWrite()).toEqual([`POST ${Q}/variant-links`, `GET ${Q}`]);
    });

    const refusals: [number, string, string][] = [
      [409, 'link_already_exists', 'Ces deux éléments sont déjà liés comme traductions.'],
      [422, 'same_language', 'Les deux langues sont identiques : choisissez-en une autre.'],
      [422, 'self_link', 'Un élément ne peut pas être lié à lui-même.'],
    ];
    for (const [status, code, message] of refusals) {
      it(`says so in French when the engine answers ${code}, and changes nothing`, async () => {
        const { api, variant, click, select, submit, afterFirstWrite } = await render();
        api.answers[`POST ${Q}/variant-links`] = engineError(status, code);

        await click('Lier une traduction', variant('fr', 2));
        select(picker(variant('fr', 2)), IDS.variantEn1);
        await submit(variant('fr', 2).querySelector<HTMLFormElement>('.link-form form')!);

        expect(text(variant('fr', 2).querySelector('.link-form [role="alert"]'))).toBe(message);
        expect(afterFirstWrite()).toEqual([`POST ${Q}/variant-links`]);
      });
    }

    it('unlinks only the chosen link, then re-fetches', async () => {
      const { variant, click, afterFirstWrite } = await render();

      await click('Délier la traduction (English)', variant('fr', 1));

      expect(afterFirstWrite()).toEqual([
        `DELETE ${Q}/variant-links/${IDS.variantEn1}-link`,
        `GET ${Q}`,
      ]);
    });

    it('re-reads the page when the link is already gone', async () => {
      const { api, element, section, click, afterFirstWrite } = await render();
      api.answers[`DELETE ${Q}/answer-links/${IDS.answerEn}-link`] = engineError(
        404,
        'link_not_found',
      );

      await click('Délier la traduction (English)', section('fr').querySelector('.answer')!);

      expect(afterFirstWrite()).toEqual([
        `DELETE ${Q}/answer-links/${IDS.answerEn}-link`,
        `GET ${Q}`,
      ]);
      expect(text(element.querySelector('.page-alert'))).toContain('Cet élément n’existe plus');
    });
  });
});
