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
    expect(sections(element)).toEqual([['Modèles de prompt', '/admin/prompts']]);
  });

  it('offers users and roles to whoever manages access', async () => {
    const { element } = await render(['manage_access']);

    expect(sections(element)).toEqual([
      ['Utilisateurs', '/admin/users'],
      ['Rôles', '/admin/roles'],
    ]);
  });

  it('offers every section to whoever holds both', async () => {
    const { element } = await render(['manage_access', 'manage_prompts']);

    expect(sections(element).map(([label]) => label)).toEqual([
      'Modèles de prompt',
      'Utilisateurs',
      'Rôles',
    ]);
  });
});
