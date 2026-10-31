import { engineError } from '../../../core/api/testing/fake-api-port';
import {
  IDS,
  LANGUAGES,
  PROJECT_LANGUAGES,
  world,
} from '../../../core/catalog/testing/catalog-fixtures';
import { renderAdmin, text } from '../testing/render-admin';
import { ProjectLanguages } from './project-languages';

const LANGUAGES_PATH = `/projects/${IDS.project}/languages`;

const render = (answers: Record<string, unknown> = {}) =>
  renderAdmin(ProjectLanguages, { ...world(), ...answers }, { projectId: IDS.project });

const rows = (element: HTMLElement) => [
  ...element.querySelectorAll<HTMLElement>('li.project-language'),
];
const rowOf = (element: HTMLElement, name: string) =>
  rows(element).find((row) => text(row.querySelector('.name')) === name)!;

describe('ProjectLanguages', () => {
  it('lists the project’s languages, its base language first, marked and not removable', async () => {
    const { element, buttonNamed } = await render();

    expect(rows(element).map((row) => text(row.querySelector('.name')))).toEqual([
      'Français',
      'Bambara',
      'English',
      'Peul',
    ]);
    const base = rowOf(element, 'Français');
    expect(text(base.querySelector('.base'))).toBe('Langue de base');
    expect(base.querySelector('button')).toBeNull();
    expect(buttonNamed('Retirer la langue Bambara du projet')).toBeDefined();
    expect(rows(element).filter((row) => row.querySelector('.base'))).toHaveLength(1);
  });

  it('adds only a catalogue language the project lacks, then re-reads', async () => {
    const { api, element, choose, submit } = await render();
    const form = element.querySelector('form.add')!;

    const options = [...form.querySelectorAll('option')]
      .map((o) => o.value)
      .filter((value) => value !== '');
    expect(options).toEqual([IDS.wo]);
    await choose('Ajouter une langue au projet', IDS.wo, form);
    await submit(form);

    expect(api.writes).toEqual([
      { method: 'PUT', path: `/projects/${IDS.project}/languages/${IDS.wo}`, body: undefined },
    ]);
    expect(api.reads.filter((path) => path === LANGUAGES_PATH)).toHaveLength(2);
  });

  it('asks for a language before adding one', async () => {
    const { api, element, submit } = await render();
    const form = element.querySelector('form.add')!;

    await submit(form);

    expect(api.writes).toEqual([]);
    expect(text(form.querySelector('.field-error'))).toBe('Choisissez une langue.');
  });

  it('says so when every catalogue language is already in the project', async () => {
    const { element } = await render({
      [LANGUAGES_PATH]: {
        items: [
          ...PROJECT_LANGUAGES.items,
          { language_id: IDS.wo, code: 'wo', name: 'Wolof', is_base: false },
        ],
      },
    });

    expect(element.querySelector('form.add')).toBeNull();
    expect(text(element.querySelector('.none'))).toBe(
      'Toutes les langues du catalogue sont déjà dans ce projet.',
    );
  });

  it('asks before removing a language, then removes it and re-reads', async () => {
    const { api, element, click } = await render();
    const peul = rowOf(element, 'Peul');

    await click('Retirer la langue Peul du projet', peul);
    expect(api.writes).toEqual([]);
    expect(text(peul)).toContain('Retirer Peul des langues du projet ?');
    await click('Confirmer', peul);

    expect(api.writes).toEqual([
      { method: 'DELETE', path: `/projects/${IDS.project}/languages/${IDS.ff}`, body: undefined },
    ]);
    expect(api.reads.filter((path) => path === LANGUAGES_PATH)).toHaveLength(2);
  });

  it('explains a language the project’s content still uses', async () => {
    const { element, click } = await render({
      [`DELETE /projects/${IDS.project}/languages/${IDS.bm}`]: engineError(
        409,
        'language_in_use_in_project',
      ),
    });

    await click('Retirer la langue Bambara du projet', rowOf(element, 'Bambara'));
    await click('Confirmer', rowOf(element, 'Bambara'));

    expect(text(rowOf(element, 'Bambara').querySelector('[role="alert"]'))).toBe(
      'Le contenu du projet utilise encore cette langue : elle ne peut pas être retirée.',
    );
  });

  describe('code-switching languages', () => {
    const CS = 'aaaaaaaa-0000-0000-0000-0000000000c5';
    const CREATE = 'POST /languages/code-switching';
    const ADD_CS = `PUT /projects/${IDS.project}/languages/${CS}`;
    const CS_LANGUAGE = {
      id: CS,
      code: 'fr_bm',
      name: 'Français + Bambara',
      kind: 'code_switching',
      component_language_ids: [IDS.bm, IDS.fr],
    };
    const ACTION = 'Langue en code-switching';

    /** The modal opens in the CDK's overlay, at the end of <body>. */
    const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
    const otherSelect = () => dialog()!.querySelector<HTMLSelectElement>('select')!;
    const optionValues = () =>
      [...otherSelect().querySelectorAll('option')].map((o) => o.value).filter((v) => v !== '');

    async function open(answers: Record<string, unknown> = {}) {
      const page = await render({ [CREATE]: CS_LANGUAGE, ...answers });
      await page.click(ACTION);
      const pick = async (languageId: string) => {
        otherSelect().value = languageId;
        otherSelect().dispatchEvent(new Event('change'));
        await page.settle();
      };
      const confirm = () => page.submit(dialog()!.querySelector('form'));
      return { ...page, pick, confirm };
    }

    it('offers to add one once the project has at least two languages', async () => {
      const { buttonNamed } = await render();

      expect(buttonNamed(ACTION)).toBeDefined();
    });

    it('does not offer it while the project has only its base language', async () => {
      const { buttonNamed } = await render({
        [LANGUAGES_PATH]: { items: [PROJECT_LANGUAGES.items[0]] },
      });

      expect(buttonNamed(ACTION)).toBeUndefined();
    });

    it('opens a modal with the base language fixed and one other project language to pick', async () => {
      await open();

      const title = document.getElementById(dialog()!.getAttribute('aria-labelledby')!);
      expect(text(title)).toBe('Ajouter une langue en code-switching');
      expect(text(dialog()!.querySelector('.fixed-base'))).toBe('Français');
      expect(optionValues()).toEqual([IDS.bm, IDS.en, IDS.ff]);
    });

    it('asks for the other language before confirming', async () => {
      const { api, confirm } = await open();

      await confirm();

      expect(api.writes).toEqual([]);
      expect(text(dialog()!.querySelector('.field-error'))).toBe('Choisissez une autre langue.');
    });

    it('creates (or reuses) base + the chosen language, adds it to the project and lists it badged', async () => {
      const { api, element, pick, confirm } = await open();
      await pick(IDS.bm);
      api.answers['/languages'] = { items: [...LANGUAGES.items, CS_LANGUAGE] };
      api.answers[LANGUAGES_PATH] = {
        items: [
          ...PROJECT_LANGUAGES.items,
          { language_id: CS, code: 'fr_bm', name: 'Français + Bambara', is_base: false },
        ],
      };

      await confirm();

      expect(api.writes).toEqual([
        {
          method: 'POST',
          path: '/languages/code-switching',
          body: {
            code: 'fr_bm',
            name: 'Français + Bambara',
            language_a_id: IDS.fr,
            language_b_id: IDS.bm,
          },
        },
        { method: 'PUT', path: `/projects/${IDS.project}/languages/${CS}`, body: undefined },
      ]);
      expect(dialog()).toBeNull();
      const row = rowOf(element, 'Français + Bambara');
      expect(text(row.querySelector('.code-switching'))).toBe('code-switching');
      expect(rowOf(element, 'Bambara').querySelector('.code-switching')).toBeNull();
    });

    it('no longer offers a language the project already mixes with its base', async () => {
      const { buttonNamed, click } = await render({
        '/languages': { items: [...LANGUAGES.items, CS_LANGUAGE] },
        [LANGUAGES_PATH]: {
          items: [
            ...PROJECT_LANGUAGES.items,
            { language_id: CS, code: 'fr_bm', name: 'Français + Bambara', is_base: false },
          ],
        },
      });

      expect(buttonNamed(ACTION)).toBeDefined();
      await click(ACTION);

      expect(optionValues()).toEqual([IDS.en, IDS.ff]);
    });

    it.each([
      [
        422,
        'code_switching_components_not_in_project',
        'Les deux langues mêlées doivent être des langues du projet.',
      ],
      [
        422,
        'code_switching_without_base_language',
        'Une langue en code-switching mêle la langue de base du projet à une autre de ses langues.',
      ],
      [
        409,
        'code_switching_language_exists',
        'Une langue en code-switching mêle déjà ces deux langues : réessayez pour la réutiliser.',
      ],
    ])('keeps the modal open and explains a %i %s', async (status, code, message) => {
      const { pick, confirm } = await open({ [ADD_CS]: engineError(status, code) });
      await pick(IDS.bm);

      await confirm();

      expect(dialog()).not.toBeNull();
      expect(text(dialog()!.querySelector('[role="alert"]'))).toBe(message);
    });

    it('explains a 409 from creating the composite language too', async () => {
      const { api, pick, confirm } = await open({
        [CREATE]: engineError(409, 'language_code_already_exists'),
      });
      await pick(IDS.en);

      await confirm();

      expect(api.writes.map((w) => w.method)).toEqual(['POST']);
      expect(text(dialog()!.querySelector('[role="alert"]'))).toBe(
        'Une langue porte déjà ce code.',
      );
    });
  });
});
