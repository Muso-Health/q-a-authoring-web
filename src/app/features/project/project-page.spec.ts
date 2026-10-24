import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApiPort } from '../../core/api/api-port';
import { FakeApiPort, engineError } from '../../core/api/testing/fake-api-port';
import { IDS, world } from '../../core/catalog/testing/catalog-fixtures';
import { provideTestI18n } from '../../core/i18n/testing/provide-test-i18n';
import { ProjectPage } from './project-page';

async function render(answers: Record<string, unknown>) {
  TestBed.configureTestingModule({
    imports: [ProjectPage],
    providers: [
      provideTestI18n(),
      provideRouter([]),
      { provide: ApiPort, useValue: new FakeApiPort(answers) },
    ],
  });
  const fixture = TestBed.createComponent(ProjectPage);
  fixture.componentRef.setInput('projectId', IDS.project);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('ProjectPage', () => {
  it('shows the project, its base language and links to its protocols', async () => {
    const element = await render(world());

    expect(element.querySelector('h1')?.textContent).toContain('Santé communautaire Mali');
    expect(element.textContent).toContain('Langue de base : Français');
    const link = element.querySelector<HTMLAnchorElement>('section a')!;
    expect(link.textContent).toContain('Paludisme');
    expect(link.getAttribute('href')).toBe(`/protocols/${IDS.protocol}`);
  });

  it('places itself in the breadcrumb under the projects', async () => {
    const element = await render(world());

    const crumbs = element.querySelectorAll('nav[aria-label="Fil d’Ariane"] li');
    expect([...crumbs].map((li) => li.textContent?.trim())).toEqual([
      'Projets',
      'Santé communautaire Mali',
    ]);
    expect(crumbs[1].querySelector('[aria-current="page"]')).not.toBeNull();
  });

  it('says so when the project has no protocol', async () => {
    const element = await render({
      ...world(),
      [`/projects/${IDS.project}/protocols`]: { items: [] },
    });

    expect(element.textContent).toContain('Aucun protocole dans ce projet.');
  });

  it('says the project does not exist when the engine says so', async () => {
    const element = await render({
      ...world(),
      [`/projects/${IDS.project}`]: engineError(404, 'project_not_found'),
    });

    expect(element.querySelector('[role="alert"]')?.textContent).toContain('introuvable');
  });
});
