import { engineError } from '../../../core/api/testing/fake-api-port';
import type { Schemas } from '../../../core/api/api-types';
import {
  IDS,
  LANGUAGES,
  PROJECT,
  PROTOCOL,
  THEME,
} from '../../../core/catalog/testing/catalog-fixtures';
import { renderAdmin, text } from '../testing/render-admin';
import { CatalogPage } from './catalog-page';

const NUTRITION: Schemas['ProjectResponse'] = {
  id: 'bbbbbbbb-0000-0000-0000-000000000002',
  name: 'Nutrition',
  description: null,
  base_language_id: IDS.bm,
};

const PROJECTS = { '/projects': { items: [PROJECT, NUTRITION] }, '/languages': LANGUAGES };

const PROTOCOLS = {
  [`/projects/${IDS.project}`]: PROJECT,
  [`/projects/${IDS.project}/protocols`]: { items: [PROTOCOL] },
};

const THEMES = {
  [`/protocols/${IDS.protocol}`]: PROTOCOL,
  [`/projects/${IDS.project}`]: PROJECT,
  [`/protocols/${IDS.protocol}/themes`]: { items: [THEME] },
};

const cardOf = (element: HTMLElement, name: string) =>
  [...element.querySelectorAll<HTMLElement>('li.entry')].find(
    (card) => text(card.querySelector('h3')) === name,
  )!;

const crumbs = (element: HTMLElement) =>
  [...element.querySelectorAll('nav ol li')].map((li) => [
    text(li),
    li.querySelector('a')?.getAttribute('href') ?? null,
  ]);

describe('CatalogPage — projects', () => {
  const render = (answers: Record<string, unknown> = {}) =>
    renderAdmin(CatalogPage, { ...PROJECTS, ...answers });

  it('lists the projects, each with its base language and a way into its protocols', async () => {
    const { element } = await render();

    expect(text(element.querySelector('h2'))).toBe('Projets');
    const santé = cardOf(element, 'Santé communautaire Mali');
    expect(text(santé)).toContain('Corpus pour les agents de santé communautaire');
    expect(text(santé)).toContain('Langue de base : Français (fr)');
    expect(santé.querySelector('h3 a')?.getAttribute('href')).toBe(
      `/admin/catalog/projects/${IDS.project}`,
    );
    expect(text(cardOf(element, 'Nutrition'))).toContain('Langue de base : Bambara (bm)');
  });

  it('creates a project in the base language picked from the engine’s languages, then re-reads', async () => {
    const { api, element, type, choose, submit } = await render();
    const form = element.querySelector('form.create');

    const options = [...form!.querySelectorAll('option')].map((o) => text(o));
    expect(options).toEqual([
      'Choisir une langue…',
      'Bambara (bm)',
      'English (en)',
      'Français (fr)',
      'Peul (ff)',
    ]);
    await type('Nom', 'Santé maternelle', form);
    await type('Description', 'Suivi des grossesses', form);
    await choose('Langue de base', IDS.bm, form);
    await submit(form);

    expect(api.writes).toEqual([
      {
        method: 'POST',
        path: '/projects',
        body: {
          name: 'Santé maternelle',
          description: 'Suivi des grossesses',
          base_language_id: IDS.bm,
        },
      },
    ]);
    expect(api.reads.filter((path) => path === '/projects')).toHaveLength(2);
    expect(form!.querySelector<HTMLInputElement>('input')!.value).toBe('');
  });

  it('asks for a name and a base language before creating', async () => {
    const { api, element, submit } = await render();
    const form = element.querySelector('form.create');

    await submit(form);

    expect(api.writes).toEqual([]);
    expect([...form!.querySelectorAll('.field-error')].map(text)).toEqual([
      'Ce champ est obligatoire.',
      'Choisissez la langue de base.',
    ]);
  });

  it('edits the name and description, never the base language', async () => {
    const { api, element, click, type, submit } = await render();

    await click('Modifier le projet Santé communautaire Mali');
    const form = cardOf(element, 'Santé communautaire Mali').querySelector('form');
    expect(form?.querySelector('select')).toBeNull();
    expect(text(form)).toContain('La langue de base ne peut pas être modifiée.');
    expect(form?.querySelector<HTMLInputElement>('input')?.value).toBe(PROJECT.name);
    await type('Nom', 'Santé communautaire', form);
    await type('Description', '', form);
    await submit(form);

    expect(api.writes).toEqual([
      {
        method: 'PATCH',
        path: `/projects/${IDS.project}`,
        body: { name: 'Santé communautaire', description: null },
      },
    ]);
    expect(api.reads.filter((path) => path === '/projects')).toHaveLength(2);
  });

  it('asks before deleting, and explains a project that still has protocols', async () => {
    const { api, element, click } = await render({
      [`DELETE /projects/${IDS.project}`]: engineError(409, 'project_has_protocols'),
    });
    const santé = cardOf(element, 'Santé communautaire Mali');

    await click('Supprimer le projet Santé communautaire Mali', santé);
    expect(api.writes).toEqual([]);
    expect(text(santé)).toContain(
      'Supprimer définitivement le projet « Santé communautaire Mali » ?',
    );
    await click('Confirmer', santé);

    expect(api.writes).toEqual([{ method: 'DELETE', path: `/projects/${IDS.project}` }]);
    expect(text(cardOf(element, 'Santé communautaire Mali').querySelector('[role="alert"]'))).toBe(
      'Ce projet contient encore des protocoles : supprimez-les d’abord.',
    );
  });

  it('deletes, then re-reads the list', async () => {
    const { api, element, click } = await render();
    const nutrition = cardOf(element, 'Nutrition');

    await click('Supprimer le projet Nutrition', nutrition);
    await click('Confirmer', nutrition);

    expect(api.writes).toEqual([{ method: 'DELETE', path: `/projects/${NUTRITION.id}` }]);
    expect(api.reads.filter((path) => path === '/projects')).toHaveLength(2);
  });

  it('maps an unknown base language and a refused name inline', async () => {
    const { api, element, type, choose, submit } = await render({
      'POST /projects': engineError(422, 'unknown_base_language'),
    });
    const form = element.querySelector('form.create');

    await type('Nom', 'Santé', form);
    await choose('Langue de base', IDS.fr, form);
    await submit(form);
    expect(text(form?.querySelector('[role="alert"]'))).toBe(
      'Cette langue de base n’est pas enregistrée dans le moteur.',
    );

    api.answers['POST /projects'] = engineError(422, 'invalid_name');
    await submit(form);
    expect(text(form?.querySelector('[role="alert"]'))).toBe(
      'Le nom a été refusé : il ne peut pas être vide.',
    );
  });

  it('says so, and re-reads, when the project has vanished meanwhile', async () => {
    const { api, element, click } = await render({
      [`DELETE /projects/${NUTRITION.id}`]: engineError(404, 'project_not_found'),
    });
    api.answers['/projects'] = { items: [PROJECT] };
    const nutrition = cardOf(element, 'Nutrition');

    await click('Supprimer le projet Nutrition', nutrition);
    await click('Confirmer', nutrition);

    // Named: the engine's `project_not_found` says what vanished.
    expect(text(element.querySelector('.page-notice'))).toBe(
      'Ce projet n’existe plus : la page a été actualisée.',
    );
    expect(cardOf(element, 'Nutrition')).toBeUndefined();
  });
});

describe('CatalogPage — protocols of a project', () => {
  const render = (answers: Record<string, unknown> = {}) =>
    renderAdmin(CatalogPage, { ...PROTOCOLS, ...answers }, { projectId: IDS.project });

  it('places itself under the catalogue and links each protocol to its themes', async () => {
    const { element } = await render();

    expect(crumbs(element)).toEqual([
      ['Catalogue', '/admin/catalog'],
      ['Santé communautaire Mali', null],
    ]);
    expect(text(element.querySelector('h2'))).toBe('Protocoles');
    expect(cardOf(element, 'Paludisme').querySelector('h3 a')?.getAttribute('href')).toBe(
      `/admin/catalog/protocols/${IDS.protocol}`,
    );
  });

  it('creates a protocol under the project, then re-reads', async () => {
    const { api, element, type, submit } = await render();
    const form = element.querySelector('form.create');

    expect(form?.querySelector('select')).toBeNull();
    await type('Nom', 'Diarrhée', form);
    await submit(form);

    expect(api.writes).toEqual([
      { method: 'POST', path: `/projects/${IDS.project}/protocols`, body: { name: 'Diarrhée' } },
    ]);
    expect(api.reads.filter((path) => path === `/projects/${IDS.project}/protocols`)).toHaveLength(
      2,
    );
  });

  it('edits a protocol, then re-reads', async () => {
    const { api, element, click, type, submit } = await render();

    await click('Modifier le protocole Paludisme');
    const form = cardOf(element, 'Paludisme').querySelector('form');
    await type('Description', 'Saison des pluies', form);
    await submit(form);

    expect(api.writes).toEqual([
      {
        method: 'PATCH',
        path: `/protocols/${IDS.protocol}`,
        body: { name: 'Paludisme', description: 'Saison des pluies' },
      },
    ]);
    expect(api.reads.filter((path) => path === `/projects/${IDS.project}/protocols`)).toHaveLength(
      2,
    );
  });

  it('explains a protocol that still has themes', async () => {
    const { element, click } = await render({
      [`DELETE /protocols/${IDS.protocol}`]: engineError(409, 'protocol_has_themes'),
    });

    await click('Supprimer le protocole Paludisme');
    await click('Confirmer', cardOf(element, 'Paludisme'));

    expect(text(cardOf(element, 'Paludisme').querySelector('[role="alert"]'))).toBe(
      'Ce protocole contient encore des thèmes : supprimez-les d’abord.',
    );
  });

  it('shows the project as gone when it no longer exists', async () => {
    const { element } = await render({
      [`/projects/${IDS.project}`]: engineError(404, 'project_not_found'),
    });

    expect(text(element.querySelector('[role="alert"]'))).toContain('Élément introuvable');
    expect(element.querySelector('form.create')).toBeNull();
  });
});

describe('CatalogPage — themes of a protocol', () => {
  const render = (answers: Record<string, unknown> = {}) =>
    renderAdmin(CatalogPage, { ...THEMES, ...answers }, { protocolId: IDS.protocol });

  it('places itself under its project in the catalogue', async () => {
    const { element } = await render();

    expect(crumbs(element)).toEqual([
      ['Catalogue', '/admin/catalog'],
      ['Santé communautaire Mali', `/admin/catalog/projects/${IDS.project}`],
      ['Paludisme', null],
    ]);
    expect(text(element.querySelector('h2'))).toBe('Thèmes');
    const prévention = cardOf(element, 'Prévention');
    expect(text(prévention)).toContain('Moustiquaires et assainissement');
    expect(prévention.querySelector('h3 a')).toBeNull();
    const docs = [...prévention.querySelectorAll('a')].find((a) => text(a) === 'Documentation');
    expect(docs?.getAttribute('href')).toBe(`/themes/${IDS.theme}/documentation`);
  });

  it('creates, edits and deletes themes, re-reading each time', async () => {
    const { api, element, click, type, submit } = await render();
    const create = element.querySelector('form.create');

    await type('Nom', 'Traitement', create);
    await type('Description', 'CTA et TDR', create);
    await submit(create);
    await click('Modifier le thème Prévention');
    const edit = cardOf(element, 'Prévention').querySelector('form');
    await type('Nom', 'Prévention du paludisme', edit);
    await submit(edit);
    await click('Supprimer le thème Prévention');
    await click('Confirmer', cardOf(element, 'Prévention'));

    expect(api.writes).toEqual([
      {
        method: 'POST',
        path: `/protocols/${IDS.protocol}/themes`,
        body: { name: 'Traitement', description: 'CTA et TDR' },
      },
      {
        method: 'PATCH',
        path: `/themes/${IDS.theme}`,
        body: { name: 'Prévention du paludisme', description: 'Moustiquaires et assainissement' },
      },
      { method: 'DELETE', path: `/themes/${IDS.theme}` },
    ]);
    expect(api.reads.filter((path) => path === `/protocols/${IDS.protocol}/themes`)).toHaveLength(
      4,
    );
  });

  it('explains a theme that still has QA sets', async () => {
    const { element, click } = await render({
      [`DELETE /themes/${IDS.theme}`]: engineError(409, 'theme_has_qasets'),
    });

    await click('Supprimer le thème Prévention');
    await click('Confirmer', cardOf(element, 'Prévention'));

    expect(text(cardOf(element, 'Prévention').querySelector('[role="alert"]'))).toBe(
      'Ce thème contient encore des ensembles questions-réponses : supprimez-les d’abord.',
    );
  });
});
