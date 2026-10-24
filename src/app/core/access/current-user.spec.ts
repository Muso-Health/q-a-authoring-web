import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiPort } from '../api/api-port';
import { FakeApiPort } from '../api/testing/fake-api-port';
import { ME_AUTHOR, ME_READER } from '../catalog/testing/catalog-fixtures';
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
});
