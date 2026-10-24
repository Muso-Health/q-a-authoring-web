import { engineError } from '../../../core/api/testing/fake-api-port';
import {
  ADMIN_IDS,
  AWA,
  LEAKED_SUBJECT,
  MOUSSA,
  ROLES,
  USERS,
} from '../../../core/admin/testing/admin-fixtures';
import { renderAdmin, text } from '../testing/render-admin';
import { UsersPage } from './users-page';

const render = (answers: Record<string, unknown> = {}) =>
  renderAdmin(UsersPage, { '/users': USERS, '/roles': ROLES, ...answers });

const cardOf = (element: HTMLElement, name: string) =>
  [...element.querySelectorAll<HTMLElement>('li.user')].find((card) =>
    text(card.querySelector('h3'))?.startsWith(name),
  )!;

describe('UsersPage', () => {
  it('shows each user’s name, email, state and roles', async () => {
    const { element } = await render();

    const awa = cardOf(element, 'Awa Traoré');
    expect(text(awa)).toContain('awa@example.org');
    expect(text(awa.querySelector('.state'))).toBe('Actif');
    expect([...awa.querySelectorAll('.roles .role-name')].map(text)).toEqual(['Auteurs']);
    expect(text(cardOf(element, 'Moussa Keita').querySelector('.state'))).toBe('Désactivé');
  });

  it('never renders the identity-provider subject', async () => {
    const { element } = await render();

    expect(element.innerHTML).not.toContain(LEAKED_SUBJECT);
  });

  it('provisions a user, then re-reads the list', async () => {
    const { api, element, type, submit } = await render({ 'POST /users': AWA });
    const form = element.querySelector('form.create');

    await type('Adresse e-mail', 'nouveau@example.org', form);
    await type('Nom affiché', 'Nouvel Utilisateur', form);
    await submit(form);

    expect(api.writes).toEqual([
      {
        method: 'POST',
        path: '/users',
        body: { email: 'nouveau@example.org', display_name: 'Nouvel Utilisateur' },
      },
    ]);
    expect(api.reads.filter((path) => path === '/users')).toHaveLength(2);
  });

  it('checks the shape of a new user before asking the engine', async () => {
    const { api, element, type, submit } = await render();
    const form = element.querySelector('form.create');

    await type('Adresse e-mail', 'pas-une-adresse', form);
    await submit(form);

    expect(api.writes).toEqual([]);
    expect(text(form)).toContain('Saisissez une adresse e-mail valide.');
    expect(text(form)).toContain('Ce champ est obligatoire.');
  });

  it('maps a duplicate email inline', async () => {
    const { element, type, submit } = await render({
      'POST /users': engineError(409, 'email_already_exists'),
    });
    const form = element.querySelector('form.create');

    await type('Adresse e-mail', 'awa@example.org', form);
    await type('Nom affiché', 'Awa', form);
    await submit(form);

    expect(text(form?.querySelector('[role="alert"]'))).toBe(
      'Un compte existe déjà avec cette adresse e-mail.',
    );
  });

  it('renames a user, then re-reads the list', async () => {
    const { api, element, click, type, submit } = await render();
    const awa = cardOf(element, 'Awa Traoré');

    await click('Modifier le nom de Awa Traoré', awa);
    await type('Nom affiché', 'Awa T.', awa);
    await submit(awa);

    expect(api.writes).toEqual([
      { method: 'PATCH', path: `/users/${ADMIN_IDS.awa}`, body: { display_name: 'Awa T.' } },
    ]);
    expect(api.reads.filter((path) => path === '/users')).toHaveLength(2);
  });

  it('deactivates and reactivates rather than deleting', async () => {
    const { api, element, click } = await render();

    await click('Désactiver le compte de Awa Traoré', cardOf(element, 'Awa Traoré'));
    await click('Confirmer', cardOf(element, 'Awa Traoré'));
    await click('Réactiver le compte de Moussa Keita', cardOf(element, 'Moussa Keita'));

    expect(api.writes).toEqual([
      { method: 'PATCH', path: `/users/${ADMIN_IDS.awa}`, body: { is_active: false } },
      { method: 'PATCH', path: `/users/${ADMIN_IDS.moussa}`, body: { is_active: true } },
    ]);
    expect(api.reads.filter((path) => path === '/users')).toHaveLength(3);
    expect(element.querySelector('button.danger, [aria-label*="Supprimer"]')).toBeNull();
  });

  it('assigns a role the user does not hold yet', async () => {
    const { api, element, choose, submit } = await render();
    const awa = cardOf(element, 'Awa Traoré');
    const form = awa.querySelector('form.assign');
    const options = [...form!.querySelectorAll('option')].map((o) => o.value).filter(Boolean);
    expect(options).toEqual([ADMIN_IDS.validators]);

    await choose('Attribuer un rôle', ADMIN_IDS.validators, form);
    await submit(form);

    expect(api.writes).toEqual([
      {
        method: 'POST',
        path: `/users/${ADMIN_IDS.awa}/roles`,
        body: { role_id: ADMIN_IDS.validators },
      },
    ]);
    expect(api.reads.filter((path) => path === '/users')).toHaveLength(2);
  });

  it('unassigns a role, then re-reads the list', async () => {
    const { api, element, click } = await render();

    await click('Retirer le rôle Auteurs à Awa Traoré', cardOf(element, 'Awa Traoré'));

    expect(api.writes).toEqual([
      { method: 'DELETE', path: `/users/${ADMIN_IDS.awa}/roles/${ADMIN_IDS.authors}` },
    ]);
    expect(api.reads.filter((path) => path === '/users')).toHaveLength(2);
  });

  it('re-reads and says so when the user no longer exists', async () => {
    const { api, element, click } = await render({
      [`DELETE /users/${ADMIN_IDS.awa}/roles/${ADMIN_IDS.authors}`]: engineError(
        404,
        'user_not_found',
      ),
    });
    api.answers['/users'] = { items: [MOUSSA] };

    await click('Retirer le rôle Auteurs à Awa Traoré', cardOf(element, 'Awa Traoré'));

    expect(text(element.querySelector('.page-notice'))).toBe(
      'Cet élément n’existe plus : la page a été actualisée.',
    );
    expect(element.querySelectorAll('li.user')).toHaveLength(1);
  });
});
