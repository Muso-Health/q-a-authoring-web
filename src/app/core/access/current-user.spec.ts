import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiPort } from '../api/api-port';
import { FakeApiPort } from '../api/testing/fake-api-port';
import { IDS, ME_AUTHOR, ME_READER, PROJECT } from '../catalog/testing/catalog-fixtures';
import { AUTHOR_QASETS, CurrentUser } from './current-user';

async function setUp(answers: Record<string, unknown>) {
  const api = new FakeApiPort(answers);
  TestBed.configureTestingModule({ providers: [{ provide: ApiPort, useValue: api }] });
  const user = TestBed.inject(CurrentUser);
  const canAuthor = user.can(AUTHOR_QASETS);
  await TestBed.inject(ApplicationRef).whenStable();
  return { api, user, canAuthor };
}

describe('CurrentUser', () => {
  it('grants what /me lists', async () => {
    const { canAuthor, user } = await setUp({ '/me': ME_AUTHOR });

    expect(canAuthor()).toBe(true);
    expect(user.can('review_clinical')()).toBe(false);
  });

  it('withholds what /me does not list', async () => {
    const { canAuthor } = await setUp({ '/me': ME_READER });

    expect(canAuthor()).toBe(false);
  });

  it('grants nothing when /me fails', async () => {
    const { canAuthor } = await setUp({});

    expect(canAuthor()).toBe(false);
  });

  it('asks /me once, however many permissions are asked about', async () => {
    const { api, user } = await setUp({ '/me': ME_AUTHOR });

    user.can('a')();
    user.can('b')();

    expect(api.reads).toEqual(['/me']);
  });

  it('names who is signed in — display name and email, nothing else', async () => {
    const { user } = await setUp({ '/me': ME_AUTHOR });

    expect(user.profile()).toEqual({ displayName: 'Awa Traoré', email: 'author@example.org' });
  });

  it('names nobody while /me has not answered, or failed', async () => {
    const { user } = await setUp({});

    expect(user.profile()).toBeNull();
  });

  it('reads the scoped assignments and grants /me now carries', async () => {
    const { user } = await setUp({
      '/me': {
        ...ME_AUTHOR,
        oid: 'entra-oid-must-not-surface',
        assignments: [
          {
            id: 'a1',
            role: { id: 'r1', name: 'Validateurs' },
            project: { id: PROJECT.id, name: PROJECT.name },
            language: { id: IDS.bm, code: 'bm', name: 'Bambara' },
          },
        ],
        grants: [{ permission: 'validate_clinical', project_id: PROJECT.id, language_id: IDS.bm }],
      },
    });

    expect(user.assignments()).toEqual([
      {
        id: 'a1',
        role: { id: 'r1', name: 'Validateurs' },
        project: { id: PROJECT.id, name: PROJECT.name },
        language: { id: IDS.bm, code: 'bm', name: 'Bambara' },
      },
    ]);
    expect(user.grants()).toEqual([
      { permission: 'validate_clinical', projectId: PROJECT.id, languageId: IDS.bm },
    ]);
    expect(JSON.stringify([user.assignments(), user.grants(), user.profile()])).not.toContain(
      'entra-oid',
    );
  });

  it('still gates on the global permission list, whatever the scope of the grant', async () => {
    const { user } = await setUp({
      '/me': {
        ...ME_AUTHOR,
        permissions: ['validate_clinical'],
        grants: [{ permission: 'validate_clinical', project_id: PROJECT.id, language_id: null }],
      },
    });

    expect(user.can('validate_clinical')()).toBe(true);
    expect(user.can('author_qasets')()).toBe(false);
  });

  it('holds no assignment or grant while /me has not answered', async () => {
    const { user } = await setUp({});

    expect(user.assignments()).toEqual([]);
    expect(user.grants()).toEqual([]);
  });
});
