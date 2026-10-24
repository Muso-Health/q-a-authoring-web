import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApiPort } from '../../core/api/api-port';
import { FakeApiPort } from '../../core/api/testing/fake-api-port';
import { IDS, world } from '../../core/catalog/testing/catalog-fixtures';
import { provideTestI18n } from '../../core/i18n/testing/provide-test-i18n';
import { ProtocolPage } from './protocol-page';

async function render(answers: Record<string, unknown>) {
  TestBed.configureTestingModule({
    imports: [ProtocolPage],
    providers: [
      provideTestI18n(),
      provideRouter([]),
      { provide: ApiPort, useValue: new FakeApiPort(answers) },
    ],
  });
  const fixture = TestBed.createComponent(ProtocolPage);
  fixture.componentRef.setInput('protocolId', IDS.protocol);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('ProtocolPage', () => {
  it('shows the protocol and links to its themes', async () => {
    const element = await render(world());

    expect(element.querySelector('h1')?.textContent).toContain('Paludisme');
    const link = element.querySelector<HTMLAnchorElement>('section a')!;
    expect(link.textContent).toContain('Prévention');
    expect(link.getAttribute('href')).toBe(`/themes/${IDS.theme}`);
    expect(element.textContent).toContain('Moustiquaires et assainissement');
  });

  it('places itself in the breadcrumb under its project', async () => {
    const element = await render(world());

    const links = element.querySelectorAll<HTMLAnchorElement>('nav[aria-label="Fil d’Ariane"] a');
    expect([...links].map((a) => [a.textContent?.trim(), a.getAttribute('href')])).toEqual([
      ['Projets', '/projects'],
      ['Santé communautaire Mali', `/projects/${IDS.project}`],
    ]);
  });

  it('says so when the protocol has no theme', async () => {
    const element = await render({
      ...world(),
      [`/protocols/${IDS.protocol}/themes`]: { items: [] },
    });

    expect(element.textContent).toContain('Aucun thème dans ce protocole.');
  });

  it('shows an error when a read fails', async () => {
    const { [`/protocols/${IDS.protocol}/themes`]: _, ...rest } = world();
    const element = await render(rest);

    expect(element.querySelector('[role="alert"]')).not.toBeNull();
  });
});
