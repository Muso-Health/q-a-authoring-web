import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { ApiPort } from '../../core/api/api-port';
import { FakeApiPort } from '../../core/api/testing/fake-api-port';
import { ME_AUTHOR } from '../../core/catalog/testing/catalog-fixtures';
import { provideTestI18n } from '../../core/i18n/testing/provide-test-i18n';
import { ADMIN_ROUTES } from './admin.routes';
import { permissionGuard } from '../../core/access/permission-guard';

@Component({ template: '' })
class Projects {}

async function landing(url: string, permissions: string[]) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTestI18n(),
      provideRouter([
        {
          path: 'admin',
          canMatch: [permissionGuard('manage_prompts', 'manage_access')],
          children: ADMIN_ROUTES,
        },
        { path: 'projects', component: Projects },
      ]),
      { provide: ApiPort, useValue: new FakeApiPort({ '/me': { ...ME_AUTHOR, permissions } }) },
    ],
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url);
  return TestBed.inject(Router).url;
}

describe('ADMIN_ROUTES', () => {
  it('opens the first section the user may see', async () => {
    expect(await landing('/admin', ['manage_prompts'])).toBe('/admin/prompts');
  });

  it('opens users first for an access manager', async () => {
    expect(await landing('/admin', ['manage_access'])).toBe('/admin/users');
  });

  it('keeps the prompt templates to whoever manages prompts', async () => {
    expect(await landing('/admin/prompts/translate', ['manage_prompts'])).toBe(
      '/admin/prompts/translate',
    );
    expect(await landing('/admin/prompts/translate', ['manage_access'])).toBe('/projects');
  });

  it('keeps users and roles to whoever manages access', async () => {
    expect(await landing('/admin/roles', ['manage_access'])).toBe('/admin/roles');
    expect(await landing('/admin/users', ['manage_prompts'])).toBe('/projects');
  });

  it('keeps the whole area from everyone else', async () => {
    expect(await landing('/admin', ['author_qasets'])).toBe('/projects');
  });
});
