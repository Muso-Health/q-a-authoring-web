import { TestBed } from '@angular/core/testing';
import { ApiPort } from '../api/api-port';
import { FakeApiPort } from '../api/testing/fake-api-port';
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
      roles: [{ id: ADMIN_IDS.authors, name: 'Auteurs' }],
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

  it('assigns and unassigns roles', async () => {
    const { api, access } = setUp();

    await access.assignRole(ADMIN_IDS.awa, ADMIN_IDS.validators);
    await access.unassignRole(ADMIN_IDS.awa, ADMIN_IDS.authors);

    expect(api.writes).toEqual([
      {
        method: 'POST',
        path: `/users/${ADMIN_IDS.awa}/roles`,
        body: { role_id: ADMIN_IDS.validators },
      },
      { method: 'DELETE', path: `/users/${ADMIN_IDS.awa}/roles/${ADMIN_IDS.authors}` },
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
