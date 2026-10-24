import { TestBed } from '@angular/core/testing';
import { ApiPort } from '../../core/api/api-port';
import type { HealthResponse, MeResponse } from '../../core/api/api-types';
import { FakeApiPort } from '../../core/api/testing/fake-api-port';
import { provideTestI18n } from '../../core/i18n/testing/provide-test-i18n';
import { EngineStatus } from './engine-status';

const ME: MeResponse = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'author@example.org',
  display_name: 'Awa Traoré',
  permissions: ['author_qasets', 'manage_audio'],
};

async function render(api: FakeApiPort) {
  TestBed.configureTestingModule({
    imports: [EngineStatus],
    providers: [provideTestI18n(), { provide: ApiPort, useValue: api }],
  });
  const fixture = TestBed.createComponent(EngineStatus);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('EngineStatus', () => {
  it('asks the API port for the engine health and the current user', async () => {
    const api = new FakeApiPort({
      '/health': { status: 'ok' } satisfies HealthResponse,
      '/me': ME,
    });

    await render(api);

    expect(api.reads).toEqual(expect.arrayContaining(['/health', '/me']));
  });

  it('renders the engine as reachable and who the engine says we are', async () => {
    const api = new FakeApiPort({ '/health': { status: 'ok' }, '/me': ME });

    const element = await render(api);

    expect(element.querySelector('h1')?.textContent).toContain('État du moteur');
    expect(element.textContent).toContain('Opérationnel');
    expect(element.textContent).toContain('Awa Traoré');
    expect(element.textContent).toContain('author@example.org');
    expect(element.textContent).toContain('author_qasets');
  });

  it('says so when the engine cannot be reached', async () => {
    const api = new FakeApiPort({});

    const element = await render(api);

    expect(element.textContent).toContain('Moteur injoignable');
    expect(element.querySelector('[role="alert"]')).not.toBeNull();
    // A down engine says nothing about who we are.
    expect(element.textContent).not.toContain('Identité non reconnue');
  });

  it('says the identity is unknown when the engine is up but refuses it', async () => {
    const api = new FakeApiPort({ '/health': { status: 'ok' } });

    const element = await render(api);

    expect(element.textContent).toContain('Identité non reconnue par le moteur');
  });
});
