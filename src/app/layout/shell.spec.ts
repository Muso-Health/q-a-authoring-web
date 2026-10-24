import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApiPort } from '../core/api/api-port';
import { FakeApiPort } from '../core/api/testing/fake-api-port';
import { ME_AUTHOR } from '../core/catalog/testing/catalog-fixtures';
import { provideTestI18n } from '../core/i18n/testing/provide-test-i18n';
import { Shell } from './shell';

async function render(permissions: string[] = []) {
  TestBed.configureTestingModule({
    imports: [Shell],
    providers: [
      provideTestI18n(),
      provideRouter([]),
      { provide: ApiPort, useValue: new FakeApiPort({ '/me': { ...ME_AUTHOR, permissions } }) },
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

    expect(element.querySelector('header')?.textContent).toContain('Muso Questions-Réponses');
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

  it('offers a skip link to the main content', async () => {
    const element = await render();

    const skip = element.querySelector<HTMLAnchorElement>('a.skip-link');
    expect(skip?.getAttribute('href')).toBe('#main');
    expect(element.querySelector('main')?.id).toBe('main');
  });
});
