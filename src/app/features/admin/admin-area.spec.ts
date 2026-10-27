import { TestBed } from '@angular/core/testing';
import { ME_AUTHOR } from '../../core/catalog/testing/catalog-fixtures';
import { renderAdmin, text } from './testing/render-admin';
import { AdminArea } from './admin-area';

const render = (permissions: string[]) =>
  renderAdmin(AdminArea, { '/me': { ...ME_AUTHOR, permissions } });

const sections = (element: HTMLElement) =>
  [...element.querySelectorAll('nav.admin-nav a')].map((a) => [text(a), a.getAttribute('href')]);

describe('AdminArea', () => {
  it('offers the prompt templates to whoever manages prompts', async () => {
    const { element } = await render(['manage_prompts']);

    expect(text(element.querySelector('h1'))).toBe('Administration');
    expect(sections(element)).toEqual([
      ['Modèles de prompt', '/admin/prompts'],
      ['Glossaire', '/admin/glossary'],
    ]);
  });

  it('offers users and roles to whoever manages access', async () => {
    const { element } = await render(['manage_access']);

    expect(sections(element)).toEqual([
      ['Utilisateurs', '/admin/users'],
      ['Rôles', '/admin/roles'],
      ['Glossaire', '/admin/glossary'],
    ]);
  });

  it('offers every section to whoever holds both', async () => {
    const { element } = await render(['manage_access', 'manage_prompts']);

    expect(sections(element).map(([label]) => label)).toEqual([
      'Modèles de prompt',
      'Utilisateurs',
      'Rôles',
      'Glossaire',
    ]);
  });

  it('offers each content section only with its own permission', async () => {
    const cases: [string, string, string][] = [
      ['manage_catalog', 'Catalogue', '/admin/catalog'],
      ['manage_languages', 'Langues', '/admin/languages'],
      ['manage_intents', 'Intentions', '/admin/intents'],
      ['manage_categories', 'Catégories', '/admin/categories'],
    ];
    for (const [permission, label, href] of cases) {
      TestBed.resetTestingModule();
      const { element } = await render([permission]);
      expect(sections(element)).toEqual([
        [label, href],
        ['Glossaire', '/admin/glossary'],
      ]);
    }
  });

  it('hides the content sections from whoever only manages prompts and access', async () => {
    const { element } = await render(['manage_access', 'manage_prompts', 'author_qasets']);

    expect(sections(element).map(([label]) => label)).not.toContain('Catalogue');
    expect(sections(element)).toHaveLength(4);
  });

  it('offers the glossary to everyone in the area: reading it needs no permission', async () => {
    for (const permissions of [['manage_glossary'], ['manage_languages'], ['manage_access']]) {
      TestBed.resetTestingModule();
      const { element } = await render(permissions);
      expect(sections(element).at(-1)).toEqual(['Glossaire', '/admin/glossary']);
    }
    TestBed.resetTestingModule();
    const { element } = await render(['manage_glossary']);
    expect(sections(element)).toEqual([['Glossaire', '/admin/glossary']]);
  });
});
