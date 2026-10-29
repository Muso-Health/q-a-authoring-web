import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApiPort } from '../../core/api/api-port';
import { FakeApiPort } from '../../core/api/testing/fake-api-port';
import { IDS, world } from '../../core/catalog/testing/catalog-fixtures';
import { provideTestI18n } from '../../core/i18n/testing/provide-test-i18n';
import { ThemePage } from './theme-page';

async function render(answers: Record<string, unknown>, language: 'fr' | 'en' = 'fr') {
  TestBed.configureTestingModule({
    imports: [ThemePage],
    providers: [
      provideTestI18n(language),
      provideRouter([]),
      { provide: ApiPort, useValue: new FakeApiPort(answers) },
    ],
  });
  const fixture = TestBed.createComponent(ThemePage);
  fixture.componentRef.setInput('themeId', IDS.theme);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('ThemePage', () => {
  it('lists its concepts as « Notions », each with its base answer and its languages', async () => {
    const element = await render(world());

    expect(element.querySelector('h1')?.textContent).toContain('Prévention');
    expect(element.querySelector('#concepts-heading')?.textContent).toContain('Notions');
    const items = [...element.querySelectorAll('section li.muso-card')];
    expect(items).toHaveLength(2);
    expect(items[0].querySelector('a')?.getAttribute('href')).toBe(`/concepts/${IDS.concept}`);
    expect(items[0].querySelector('a')?.textContent).toContain('Notion 1');
    expect(items[0].querySelector('.answer')?.textContent).toContain(
      'Dormez chaque nuit sous une moustiquaire',
    );
    // Base language first, whatever the engine's order.
    const chips = [...items[0].querySelectorAll('.muso-chips li')].map((li) =>
      li.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(chips).toEqual(['Français · 3 variantes', 'English · 1 variante']);
    expect(items[1].textContent).toContain('Notion 2');
    expect(element.textContent).not.toMatch(/ensemble/i);
  });

  it('names them « Concepts » in English', async () => {
    const element = await render(world(), 'en');

    expect(element.querySelector('#concepts-heading')?.textContent).toContain('Concepts');
    expect(element.querySelector('section li.muso-card a')?.textContent).toContain('Concept 1');
  });

  it('places itself in the breadcrumb under its protocol', async () => {
    const element = await render(world());

    const crumbs = element.querySelectorAll('nav[aria-label="Fil d’Ariane"] li');
    expect([...crumbs].map((li) => li.textContent?.trim())).toEqual([
      'Projets',
      'Santé communautaire Mali',
      'Paludisme',
      'Prévention',
    ]);
  });

  it('leads to its documentation and completeness', async () => {
    const element = await render(world());

    const link = [...element.querySelectorAll('a')].find(
      (a) => a.textContent?.trim() === 'Documentation et complétude',
    );
    expect(link?.getAttribute('href')).toBe(`/themes/${IDS.theme}/documentation`);
  });

  it('says so when the theme has no concept', async () => {
    const element = await render({ ...world(), [`/themes/${IDS.theme}/concepts`]: { items: [] } });

    expect(element.textContent).toContain('Aucune notion dans ce thème.');
  });

  it('shows an error when a read fails', async () => {
    const element = await render({});

    expect(element.querySelector('[role="alert"]')).not.toBeNull();
  });
});
