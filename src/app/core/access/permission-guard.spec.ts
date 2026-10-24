import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, type CanMatchFn, type Route, type UrlSegment } from '@angular/router';
import { provideRouter } from '@angular/router';
import { ApiPort } from '../api/api-port';
import { FakeApiPort } from '../api/testing/fake-api-port';
import { ME_AUTHOR } from '../catalog/testing/catalog-fixtures';
import { permissionGuard } from './permission-guard';

async function run(guard: CanMatchFn, permissions: string[] | null) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: ApiPort,
        useValue: new FakeApiPort(
          permissions === null ? {} : { '/me': { ...ME_AUTHOR, permissions } },
        ),
      },
    ],
  });
  return TestBed.runInInjectionContext(() => guard({} as Route, [] as UrlSegment[], {} as never));
}

describe('permissionGuard', () => {
  it('lets in whoever holds the permission', async () => {
    expect(await run(permissionGuard('validate_audio'), ['validate_audio'])).toBe(true);
  });

  it('sends everyone else to the projects', async () => {
    const result = await run(permissionGuard('validate_audio'), ['validate_clinical']);

    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/projects');
  });

  it('lets in whoever holds any of several permissions', async () => {
    const guard = permissionGuard('manage_prompts', 'manage_access');

    expect(await run(guard, ['manage_access'])).toBe(true);
  });

  it('refuses when who we are cannot be read', async () => {
    expect(await run(permissionGuard('validate_audio'), null)).toBeInstanceOf(UrlTree);
  });
});
