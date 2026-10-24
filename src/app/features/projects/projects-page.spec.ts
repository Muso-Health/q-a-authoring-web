import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApiPort } from '../../core/api/api-port';
import { FakeApiPort } from '../../core/api/testing/fake-api-port';
import { IDS, world } from '../../core/catalog/testing/catalog-fixtures';
import { provideTestI18n } from '../../core/i18n/testing/provide-test-i18n';
import { ProjectsPage } from './projects-page';

async function render(answers: Record<string, unknown>) {
  TestBed.configureTestingModule({
    imports: [ProjectsPage],
    providers: [
      provideTestI18n(),
      provideRouter([]),
      { provide: ApiPort, useValue: new FakeApiPort(answers) },
    ],
  });
  const fixture = TestBed.createComponent(ProjectsPage);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('ProjectsPage', () => {
  it('lists the projects, each with its base language, linking to it', async () => {
    const element = await render(world());

    expect(element.querySelector('h1')?.textContent).toContain('Projets');
    const link = element.querySelector<HTMLAnchorElement>('ul a')!;
    expect(link.textContent).toContain('Santé communautaire Mali');
    expect(link.getAttribute('href')).toBe(`/projects/${IDS.project}`);
    expect(element.textContent).toContain('Corpus pour les agents de santé communautaire');
    expect(element.textContent).toContain('Langue de base : Français');
  });

  it('says so when there is no project', async () => {
    const element = await render({ ...world(), '/projects': { items: [] } });

    expect(element.textContent).toContain('Aucun projet pour le moment.');
  });

  it('shows an error when the read fails', async () => {
    const element = await render({});

    expect(element.querySelector('[role="alert"]')?.textContent).toContain('injoignable');
  });
});
