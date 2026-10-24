import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTestI18n } from '../core/i18n/testing/provide-test-i18n';
import { Shell } from './shell';

async function render() {
  TestBed.configureTestingModule({
    imports: [Shell],
    providers: [provideTestI18n(), provideRouter([])],
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

  it('offers a skip link to the main content', async () => {
    const element = await render();

    const skip = element.querySelector<HTMLAnchorElement>('a.skip-link');
    expect(skip?.getAttribute('href')).toBe('#main');
    expect(element.querySelector('main')?.id).toBe('main');
  });
});
