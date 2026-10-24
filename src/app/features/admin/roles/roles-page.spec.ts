import { engineError } from '../../../core/api/testing/fake-api-port';
import { ADMIN_IDS, PERMISSIONS, ROLES } from '../../../core/admin/testing/admin-fixtures';
import { renderAdmin, text } from '../testing/render-admin';
import { RolesPage } from './roles-page';

const render = (answers: Record<string, unknown> = {}) =>
  renderAdmin(RolesPage, { '/roles': ROLES, '/permissions': PERMISSIONS, ...answers });

const cardOf = (element: HTMLElement, name: string) =>
  [...element.querySelectorAll<HTMLElement>('li.role')].find(
    (card) => text(card.querySelector('h3')) === name,
  )!;

describe('RolesPage', () => {
  it('shows each role with its permissions, in words', async () => {
    const { element } = await render();

    const authors = cardOf(element, 'Auteurs');
    expect([...authors.querySelectorAll('.permissions li')].map(text)).toEqual([
      'Rédiger les ensembles',
      'Gérer les enregistrements audio',
    ]);
  });

  it('builds the permission picker from the engine’s catalogue', async () => {
    const { element } = await render();
    const form = element.querySelector('form.create')!;

    const choices = [...form.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    expect(choices.map((box) => box.value)).toEqual(PERMISSIONS.items);
    expect(text(form.querySelector('fieldset legend'))).toBe('Permissions');
  });

  it('creates a role with the chosen permissions, then re-reads the list', async () => {
    const { api, element, type, toggle, submit } = await render();
    const form = element.querySelector('form.create');

    await type('Nom du rôle', 'Relecteurs', form);
    await toggle('Valider cliniquement', form);
    await toggle('Gérer les accès', form);
    await submit(form);

    expect(api.writes).toEqual([
      {
        method: 'POST',
        path: '/roles',
        body: { name: 'Relecteurs', permissions: ['validate_clinical', 'manage_access'] },
      },
    ]);
    expect(api.reads.filter((path) => path === '/roles')).toHaveLength(2);
  });

  it('maps a taken name and an unknown permission inline', async () => {
    const { api, element, type, submit } = await render({
      'POST /roles': engineError(409, 'role_name_exists'),
    });
    const form = element.querySelector('form.create');

    await type('Nom du rôle', 'Auteurs', form);
    await submit(form);
    expect(text(form?.querySelector('[role="alert"]'))).toBe('Un rôle porte déjà ce nom.');

    api.answers['POST /roles'] = engineError(422, 'unknown_permission');
    await submit(form);
    expect(text(form?.querySelector('[role="alert"]'))).toBe(
      'Une des permissions n’existe pas dans le catalogue du moteur.',
    );
  });

  it('edits a role’s name and permissions, starting from what it has', async () => {
    const { api, element, click, type, toggle, submit } = await render();
    const authors = cardOf(element, 'Auteurs');

    await click('Modifier le rôle Auteurs', authors);
    const form = cardOf(element, 'Auteurs').querySelector('form');
    expect(form?.querySelector<HTMLInputElement>('input[value="author_qasets"]')?.checked).toBe(
      true,
    );
    await type('Nom du rôle', 'Auteurs principaux', form);
    await toggle('Gérer les enregistrements audio', form);
    await submit(form);

    expect(api.writes).toEqual([
      {
        method: 'PATCH',
        path: `/roles/${ADMIN_IDS.authors}`,
        body: { name: 'Auteurs principaux', permissions: ['author_qasets'] },
      },
    ]);
    expect(api.reads.filter((path) => path === '/roles')).toHaveLength(2);
  });

  it('asks before deleting a role, then re-reads the list', async () => {
    const { api, element, click } = await render();
    const validators = cardOf(element, 'Validateurs cliniques');

    await click('Supprimer le rôle Validateurs cliniques', validators);
    expect(api.writes).toEqual([]);
    expect(text(validators)).toContain(
      'Supprimer définitivement le rôle « Validateurs cliniques » ?',
    );
    await click('Confirmer', validators);

    expect(api.writes).toEqual([{ method: 'DELETE', path: `/roles/${ADMIN_IDS.validators}` }]);
    expect(api.reads.filter((path) => path === '/roles')).toHaveLength(2);
  });

  it('explains that a role still held cannot be deleted', async () => {
    const { element, click } = await render({
      [`DELETE /roles/${ADMIN_IDS.authors}`]: engineError(409, 'role_in_use'),
    });
    const authors = cardOf(element, 'Auteurs');

    await click('Supprimer le rôle Auteurs', authors);
    await click('Confirmer', authors);

    expect(text(cardOf(element, 'Auteurs').querySelector('[role="alert"]'))).toBe(
      'Ce rôle est encore attribué à des utilisateurs : retirez-le-leur avant de le supprimer.',
    );
  });
});
