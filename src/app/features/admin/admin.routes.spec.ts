import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { ApiPort } from '../../core/api/api-port';
import { FakeApiPort } from '../../core/api/testing/fake-api-port';
import { ME_AUTHOR } from '../../core/catalog/testing/catalog-fixtures';
import { provideTestI18n } from '../../core/i18n/testing/provide-test-i18n';
import { ADMIN_ROUTES } from './admin.routes';
import { permissionGuard } from '../../core/access/permission-guard';
import { ADMIN_PERMISSIONS } from '../../core/access/current-user';

@Component({ template: '' })
class Projects {}

async function landing(url: string, permissions: string[]) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTestI18n(),
      provideRouter(
        [
          {
            path: 'admin',
            canMatch: [permissionGuard(...ADMIN_PERMISSIONS)],
            children: ADMIN_ROUTES,
          },
          { path: 'projects', component: Projects },
        ],
        withComponentInputBinding(),
      ),
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

  it('opens the first content section a content manager may see', async () => {
    expect(await landing('/admin', ['manage_catalog'])).toBe('/admin/catalog');
    expect(await landing('/admin', ['manage_intents', 'manage_categories'])).toBe('/admin/intents');
  });

  it('keeps the catalogue, at every level, to whoever manages it', async () => {
    for (const url of [
      '/admin/catalog',
      '/admin/catalog/projects/p1',
      '/admin/catalog/protocols/x',
    ]) {
      expect(await landing(url, ['manage_catalog'])).toBe(url);
      expect(await landing(url, ['manage_languages'])).toBe('/projects');
    }
  });

  it('keeps each taxonomy to whoever manages it', async () => {
    const cases: [string, string][] = [
      ['/admin/languages', 'manage_languages'],
      ['/admin/intents', 'manage_intents'],
      ['/admin/categories', 'manage_categories'],
    ];
    for (const [url, permission] of cases) {
      expect(await landing(url, [permission])).toBe(url);
      expect(await landing(url, ['manage_catalog'])).toBe('/projects');
    }
  });

  it('keeps the whole area from everyone else', async () => {
    expect(await landing('/admin', ['author_qasets'])).toBe('/projects');
  });
});
