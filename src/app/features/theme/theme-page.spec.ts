import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApiPort } from '../../core/api/api-port';
import { FakeApiPort } from '../../core/api/testing/fake-api-port';
import { IDS, world } from '../../core/catalog/testing/catalog-fixtures';
import { provideTestI18n } from '../../core/i18n/testing/provide-test-i18n';
import { ThemePage } from './theme-page';

async function render(answers: Record<string, unknown>) {
  TestBed.configureTestingModule({
    imports: [ThemePage],
    providers: [
      provideTestI18n(),
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
  it('lists its QASets, each with its languages and variant counts', async () => {
    const element = await render(world());

    expect(element.querySelector('h1')?.textContent).toContain('Prévention');
    const items = [...element.querySelectorAll('section li.muso-card')];
    expect(items).toHaveLength(2);
    expect(items[0].querySelector('a')?.getAttribute('href')).toBe(`/qasets/${IDS.qaset}`);
    expect(items[0].textContent).toContain('Ensemble 1');
    expect(items[0].textContent).toContain('Français');
    expect(items[0].textContent).toContain('3 variantes');
    expect(items[0].textContent).toContain('English');
    expect(items[0].textContent).toContain('1 variante');
    expect(items[1].textContent).toContain('Ensemble 2');
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

  it('says so when the theme has no QASet', async () => {
    const element = await render({ ...world(), [`/themes/${IDS.theme}/qasets`]: { items: [] } });

    expect(element.textContent).toContain('Aucun ensemble questions-réponses dans ce thème.');
  });

  it('shows an error when a read fails', async () => {
    const element = await render({});

    expect(element.querySelector('[role="alert"]')).not.toBeNull();
  });
});
