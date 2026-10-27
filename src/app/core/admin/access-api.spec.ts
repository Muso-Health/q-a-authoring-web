import { TestBed } from '@angular/core/testing';
import { ApiPort } from '../api/api-port';
import { FakeApiPort } from '../api/testing/fake-api-port';
import { IDS, PROJECT } from '../catalog/testing/catalog-fixtures';
import { AccessApi } from './access-api';
import {
  ADMIN_IDS,
  AWA,
  LEAKED_SUBJECT,
  PERMISSIONS,
  ROLES,
  USERS,
  VALIDATORS,
} from './testing/admin-fixtures';

function setUp(answers: Record<string, unknown> = {}) {
  const api = new FakeApiPort(answers);
  TestBed.configureTestingModule({ providers: [{ provide: ApiPort, useValue: api }] });
  return { api, access: TestBed.inject(AccessApi) };
}

describe('AccessApi', () => {
  it('lists users with only what the UI may show', async () => {
    const { access } = setUp({ '/users': USERS });

    const users = await access.users();

    expect(users[0]).toEqual({
      id: ADMIN_IDS.awa,
      email: 'awa@example.org',
      displayName: 'Awa Traoré',
      active: true,
      assignments: [
        {
          id: ADMIN_IDS.awaAuthorsInProject,
          role: { id: ADMIN_IDS.authors, name: 'Auteurs' },
          project: { id: PROJECT.id, name: 'Santé communautaire Mali' },
          language: null,
        },
        {
          id: ADMIN_IDS.awaValidatorsInBambara,
          role: { id: ADMIN_IDS.validators, name: 'Validateurs cliniques' },
          project: null,
          language: { id: IDS.bm, code: 'bm', name: 'Bambara' },
        },
      ],
      grants: [
        { permission: 'author_qasets', projectId: PROJECT.id, languageId: null },
        { permission: 'manage_audio', projectId: PROJECT.id, languageId: null },
        { permission: 'validate_clinical', projectId: null, languageId: IDS.bm },
      ],
    });
    expect(JSON.stringify(users)).not.toContain(LEAKED_SUBJECT);
  });

  it('provisions, renames and (de)activates users', async () => {
    const { api, access } = setUp({ 'POST /users': AWA });

    await access.createUser('awa@example.org', 'Awa Traoré');
    await access.updateUser(ADMIN_IDS.awa, { displayName: 'Awa T.' });
    await access.updateUser(ADMIN_IDS.awa, { active: false });

    expect(api.writes).toEqual([
      {
        method: 'POST',
        path: '/users',
        body: { email: 'awa@example.org', display_name: 'Awa Traoré' },
      },
      { method: 'PATCH', path: `/users/${ADMIN_IDS.awa}`, body: { display_name: 'Awa T.' } },
      { method: 'PATCH', path: `/users/${ADMIN_IDS.awa}`, body: { is_active: false } },
    ]);
  });

  it('assigns a role within a scope, null meaning any project or any language', async () => {
    const { api, access } = setUp();

    await access.assign(ADMIN_IDS.awa, {
      roleId: ADMIN_IDS.validators,
      projectId: null,
      languageId: null,
    });
    await access.assign(ADMIN_IDS.awa, {
      roleId: ADMIN_IDS.authors,
      projectId: PROJECT.id,
      languageId: IDS.bm,
    });

    expect(api.writes).toEqual([
      {
        method: 'POST',
        path: `/users/${ADMIN_IDS.awa}/assignments`,
        body: { role_id: ADMIN_IDS.validators, project_id: null, language_id: null },
      },
      {
        method: 'POST',
        path: `/users/${ADMIN_IDS.awa}/assignments`,
        body: { role_id: ADMIN_IDS.authors, project_id: PROJECT.id, language_id: IDS.bm },
      },
    ]);
  });

  it('removes an assignment by its own id, not by role', async () => {
    const { api, access } = setUp();

    await access.unassign(ADMIN_IDS.awa, ADMIN_IDS.awaAuthorsInProject);

    expect(api.writes).toEqual([
      {
        method: 'DELETE',
        path: `/users/${ADMIN_IDS.awa}/assignments/${ADMIN_IDS.awaAuthorsInProject}`,
      },
    ]);
  });

  it('lists roles and the fixed permission catalogue', async () => {
    const { access } = setUp({ '/roles': ROLES, '/permissions': PERMISSIONS });

    expect((await access.roles())[1]).toEqual(VALIDATORS);
    expect(await access.permissions()).toEqual(PERMISSIONS.items);
  });

  it('creates, edits and deletes roles', async () => {
    const { api, access } = setUp();

    await access.createRole('Relecteurs', ['validate_translation']);
    await access.updateRole(ADMIN_IDS.validators, 'Cliniciens', ['validate_clinical']);
    await access.deleteRole(ADMIN_IDS.validators);

    expect(api.writes).toEqual([
      {
        method: 'POST',
        path: '/roles',
        body: { name: 'Relecteurs', permissions: ['validate_translation'] },
      },
      {
        method: 'PATCH',
        path: `/roles/${ADMIN_IDS.validators}`,
        body: { name: 'Cliniciens', permissions: ['validate_clinical'] },
      },
      { method: 'DELETE', path: `/roles/${ADMIN_IDS.validators}` },
    ]);
  });
});
