import { TestBed } from '@angular/core/testing';
import { engineError } from '../../../core/api/testing/fake-api-port';
import {
  ADMIN_IDS,
  AWA,
  LEAKED_SUBJECT,
  MOUSSA,
  ROLES,
  USERS,
} from '../../../core/admin/testing/admin-fixtures';
import { IDS, LANGUAGES, PROJECT } from '../../../core/catalog/testing/catalog-fixtures';
import { renderAdmin, text } from '../testing/render-admin';
import { UsersPage } from './users-page';

const render = (answers: Record<string, unknown> = {}) =>
  renderAdmin(UsersPage, {
    '/users': USERS,
    '/roles': ROLES,
    '/projects': { items: [PROJECT] },
    '/languages': LANGUAGES,
    ...answers,
  });

/** Each assignment row as [role, project, language], as the reader sees them. */
const assignmentsOf = (card: HTMLElement) =>
  [...card.querySelectorAll<HTMLElement>('li.assignment')].map((row) => [
    text(row.querySelector('.role-name')),
    text(row.querySelector('.scope-project')),
    text(row.querySelector('.scope-language')),
  ]);

const AWA_AUTHORS_REMOVE =
  'Retirer le rôle Auteurs (Santé communautaire Mali, Toutes les langues) à Awa Traoré';

const cardOf = (element: HTMLElement, name: string) =>
  [...element.querySelectorAll<HTMLElement>('li.user')].find((card) =>
    text(card.querySelector('h3'))?.startsWith(name),
  )!;

describe('UsersPage', () => {
  it('shows each user’s name, email, state and scoped assignments, "any" spelt out', async () => {
    const { element } = await render();

    const awa = cardOf(element, 'Awa Traoré');
    expect(text(awa)).toContain('awa@example.org');
    expect(text(awa.querySelector('.state'))).toBe('Actif');
    expect(assignmentsOf(awa)).toEqual([
      ['Auteurs', 'Projet : Santé communautaire Mali', 'Langue : Toutes les langues'],
      ['Validateurs cliniques', 'Projet : Tous les projets', 'Langue : Bambara'],
    ]);
    const moussa = cardOf(element, 'Moussa Keita');
    expect(text(moussa.querySelector('.state'))).toBe('Désactivé');
    expect(assignmentsOf(moussa)).toEqual([]);
    expect(text(moussa)).toContain('Aucun rôle');
  });

  it('shows no identifier of a project, language or assignment', async () => {
    const { element } = await render();

    const awa = text(cardOf(element, 'Awa Traoré'))!;
    for (const id of [PROJECT.id, IDS.bm, ADMIN_IDS.awaAuthorsInProject]) {
      expect(awa).not.toContain(id);
    }
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

  it('offers every role, then any or a chosen project and language', async () => {
    const { element } = await render();
    const form = cardOf(element, 'Awa Traoré').querySelector('form.assign')!;
    const optionsOf = (label: string) => {
      const select = [...form.querySelectorAll('label')].find((l) => text(l) === label)!;
      return [...form.querySelectorAll<HTMLOptionElement>(`#${select.htmlFor} option`)].map(
        (option) => [option.value, text(option)],
      );
    };

    // The same role may be held in several scopes, so none is hidden for being held already.
    expect(optionsOf('Attribuer un rôle').map(([value]) => value)).toEqual([
      '',
      ADMIN_IDS.authors,
      ADMIN_IDS.validators,
    ]);
    expect(optionsOf('Projet')).toEqual([
      ['', 'Tous les projets'],
      [PROJECT.id, 'Santé communautaire Mali'],
    ]);
    expect(optionsOf('Langue')).toEqual([
      ['', 'Toutes les langues'],
      [IDS.bm, 'Bambara'],
      [IDS.en, 'English'],
      [IDS.fr, 'Français'],
      [IDS.ff, 'Peul'],
    ]);
  });

  it('assigns in any project and any language by default: both sent as null', async () => {
    const { api, element, choose, submit } = await render();
    const form = cardOf(element, 'Moussa Keita').querySelector('form.assign');

    await choose('Attribuer un rôle', ADMIN_IDS.authors, form);
    await submit(form);

    expect(api.writes).toEqual([
      {
        method: 'POST',
        path: `/users/${ADMIN_IDS.moussa}/assignments`,
        body: { role_id: ADMIN_IDS.authors, project_id: null, language_id: null },
      },
    ]);
    expect(api.reads.filter((path) => path === '/users')).toHaveLength(2);
  });

  it('assigns within the project and language chosen, then resets the form', async () => {
    const { api, element, choose, submit } = await render();
    const form = cardOf(element, 'Awa Traoré').querySelector<HTMLFormElement>('form.assign')!;

    await choose('Attribuer un rôle', ADMIN_IDS.validators, form);
    await choose('Projet', PROJECT.id, form);
    await choose('Langue', IDS.fr, form);
    await submit(form);

    expect(api.writes).toEqual([
      {
        method: 'POST',
        path: `/users/${ADMIN_IDS.awa}/assignments`,
        body: { role_id: ADMIN_IDS.validators, project_id: PROJECT.id, language_id: IDS.fr },
      },
    ]);
    const fresh = cardOf(element, 'Awa Traoré').querySelector('form.assign')!;
    expect([...fresh.querySelectorAll('select')].map((select) => select.value)).toEqual([
      '',
      '',
      '',
    ]);
  });

  it('does not ask again for a role the user already holds in that very scope', async () => {
    const { api, element, choose, submit } = await render();
    const awa = cardOf(element, 'Awa Traoré');
    const form = awa.querySelector('form.assign');

    await choose('Attribuer un rôle', ADMIN_IDS.authors, form);
    await choose('Projet', PROJECT.id, form);
    await submit(form);

    expect(api.writes).toEqual([]);
    expect(text(awa.querySelector('.field-error'))).toBe(
      'Awa Traoré a déjà ce rôle dans ce périmètre.',
    );
  });

  it('treats the engine’s “already assigned” (200) as done', async () => {
    const { api, element, choose, submit } = await render({
      [`POST /users/${ADMIN_IDS.moussa}/assignments`]: MOUSSA,
    });
    const moussa = cardOf(element, 'Moussa Keita');

    await choose('Attribuer un rôle', ADMIN_IDS.authors, moussa.querySelector('form.assign'));
    await submit(moussa.querySelector('form.assign'));

    expect(api.writes).toHaveLength(1);
    expect(moussa.querySelector('[role="alert"]')).toBeNull();
  });

  it('asks for a role before assigning', async () => {
    const { api, element, submit } = await render();
    const awa = cardOf(element, 'Awa Traoré');

    await submit(awa.querySelector('form.assign'));

    expect(api.writes).toEqual([]);
    expect(text(awa.querySelector('.field-error'))).toBe('Choisissez un rôle.');
  });

  it('removes one assignment by its id, then re-reads the list', async () => {
    const { api, element, click } = await render();

    await click(AWA_AUTHORS_REMOVE, cardOf(element, 'Awa Traoré'));

    expect(api.writes).toEqual([
      {
        method: 'DELETE',
        path: `/users/${ADMIN_IDS.awa}/assignments/${ADMIN_IDS.awaAuthorsInProject}`,
      },
    ]);
    expect(api.reads.filter((path) => path === '/users')).toHaveLength(2);
  });

  it('says an assignment was already removed, and re-reads', async () => {
    const { api, element, click } = await render({
      [`DELETE /users/${ADMIN_IDS.awa}/assignments/${ADMIN_IDS.awaAuthorsInProject}`]: engineError(
        404,
        'assignment_not_found',
      ),
    });
    api.answers['/users'] = { items: [{ ...AWA, assignments: [] }, MOUSSA] };

    await click(AWA_AUTHORS_REMOVE, cardOf(element, 'Awa Traoré'));

    expect(text(element.querySelector('.page-notice'))).toBe(
      'Cette attribution avait déjà été retirée : la page a été actualisée.',
    );
    expect(assignmentsOf(cardOf(element, 'Awa Traoré'))).toEqual([]);
  });

  it('says which choice vanished — role, project or language — and re-reads the choices', async () => {
    for (const [code, message] of [
      ['role_not_found', 'Ce rôle n’existe plus : la page a été actualisée.'],
      ['project_not_found', 'Ce projet n’existe plus : la page a été actualisée.'],
      ['language_not_found', 'Cette langue n’existe plus : la page a été actualisée.'],
    ]) {
      TestBed.resetTestingModule();
      const { api, element, choose, submit } = await render({
        [`POST /users/${ADMIN_IDS.moussa}/assignments`]: engineError(404, code),
      });
      const form = cardOf(element, 'Moussa Keita').querySelector('form.assign');

      await choose('Attribuer un rôle', ADMIN_IDS.authors, form);
      await submit(form);

      expect(text(element.querySelector('.page-notice'))).toBe(message);
      for (const path of ['/users', '/roles', '/projects', '/languages']) {
        expect(
          api.reads.filter((read) => read === path),
          path,
        ).toHaveLength(2);
      }
    }
  });

  it('re-reads and says so when the user no longer exists', async () => {
    const { api, element, click } = await render({
      [`DELETE /users/${ADMIN_IDS.awa}/assignments/${ADMIN_IDS.awaAuthorsInProject}`]: engineError(
        404,
        'user_not_found',
      ),
    });
    api.answers['/users'] = { items: [MOUSSA] };

    await click(AWA_AUTHORS_REMOVE, cardOf(element, 'Awa Traoré'));

    expect(text(element.querySelector('.page-notice'))).toBe(
      'Cet élément n’existe plus : la page a été actualisée.',
    );
    expect(element.querySelectorAll('li.user')).toHaveLength(1);
  });
});
