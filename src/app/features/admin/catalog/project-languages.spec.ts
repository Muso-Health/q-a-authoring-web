import { engineError } from '../../../core/api/testing/fake-api-port';
import { IDS, PROJECT_LANGUAGES, world } from '../../../core/catalog/testing/catalog-fixtures';
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
});
