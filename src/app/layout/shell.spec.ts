import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApiPort } from '../core/api/api-port';
import { AuthPort } from '../core/auth/auth-port';
import { FakeAuthPort } from '../core/auth/testing/fake-auth-port';
import { FakeApiPort } from '../core/api/testing/fake-api-port';
import { ME_AUTHOR } from '../core/catalog/testing/catalog-fixtures';
import { provideTestI18n } from '../core/i18n/testing/provide-test-i18n';
import { Translator } from '../core/i18n/translator';
import { Shell } from './shell';

async function render(permissions: string[] = []) {
  TestBed.configureTestingModule({
    imports: [Shell],
    providers: [
      provideTestI18n(),
      provideRouter([]),
      { provide: ApiPort, useValue: new FakeApiPort({ '/me': { ...ME_AUTHOR, permissions } }) },
      { provide: AuthPort, useValue: new FakeAuthPort() },
    ],
  });
  const fixture = TestBed.createComponent(Shell);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('Shell', () => {
  it('frames the outlet with a banner, a navigation and a main landmark', async () => {
    const element = await render();

    expect(element.querySelector('header')).not.toBeNull();
    expect(element.querySelector('nav')?.getAttribute('aria-label')).toBe('Navigation principale');
    expect(element.querySelector('main router-outlet')).not.toBeNull();
  });

  it('names the application in French and links to the projects and the engine status', async () => {
    const element = await render();

    // The logo says Muso; the wordmark beside it says which Muso application this is.
    expect(element.querySelector('header img')?.getAttribute('alt')).toBe('Muso');
    expect(element.querySelector('header .product')?.textContent?.trim()).toBe(
      'Questions-Réponses',
    );
    const links = [...element.querySelectorAll<HTMLAnchorElement>('nav a')];
    expect(links.map((a) => [a.textContent?.trim(), a.getAttribute('href')])).toEqual([
      ['Projets', '/projects'],
      ['État du moteur', '/status'],
    ]);
  });

  it('lists only the validation queues /me permits', async () => {
    const element = await render(['validate_clinical', 'validate_audio']);

    const links = [...element.querySelectorAll<HTMLAnchorElement>('nav a')].map((a) => [
      a.textContent?.trim(),
      a.getAttribute('href'),
    ]);
    expect(links).toEqual([
      ['Projets', '/projects'],
      ['Validation clinique', '/validation/clinical'],
      ['Validation audio', '/validation/audio'],
      ['État du moteur', '/status'],
    ]);
  });

  it('offers the administration to whoever manages any part of it', async () => {
    for (const permission of [
      'manage_prompts',
      'manage_access',
      'manage_catalog',
      'manage_languages',
      'manage_intents',
      'manage_categories',
    ]) {
      TestBed.resetTestingModule();
      const element = await render([permission]);
      const admin = [...element.querySelectorAll('nav a')].find(
        (a) => a.textContent?.trim() === 'Administration',
      );
      expect(admin?.getAttribute('href')).toBe('/admin');
    }
  });

  it('hides the administration from everyone else', async () => {
    const element = await render(['author_qasets', 'validate_clinical']);

    expect(element.querySelector('nav a[href="/admin"]')).toBeNull();
  });

  it('carries the language switcher in the header, and switching repaints the frame', async () => {
    const element = await render();
    expect(element.querySelector('header app-language-switcher')).not.toBeNull();
    // The user menu sits after it, at the far end of the header.
    expect(
      element.querySelector('header app-language-switcher + app-user-menu .trigger'),
    ).not.toBeNull();

    TestBed.inject(Translator).use('en');
    await TestBed.inject(ApplicationRef).whenStable();

    expect(element.querySelector('header .product')?.textContent?.trim()).toBe('Q&A Authoring');
    expect(element.querySelector('nav a')?.textContent?.trim()).toBe('Projects');
  });

  it('offers a skip link to the main content', async () => {
    const element = await render();

    const skip = element.querySelector<HTMLAnchorElement>('a.skip-link');
    expect(skip?.getAttribute('href')).toBe('#main');
    expect(element.querySelector('main')?.id).toBe('main');
  });
});
