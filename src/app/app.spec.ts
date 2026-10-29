import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  it('renders nothing but an outlet', () => {
    TestBed.configureTestingModule({ imports: [App], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(App);

    expect((fixture.nativeElement as HTMLElement).querySelector('router-outlet')).not.toBeNull();
  });

  it('lands on the projects inside the shell, every page lazily', () => {
    const [shell] = routes;
    const children = shell.children ?? [];

    expect(shell.path).toBe('');
    expect(children.find((route) => route.path === '')?.redirectTo).toBe('projects');
    for (const path of [
      'projects',
      'projects/:projectId',
      'protocols/:protocolId',
      'themes/:themeId',
      'concepts/:conceptId',
      'validation/clinical',
      'validation/translation',
      'validation/audio',
      'status',
    ]) {
      expect(children.find((route) => route.path === path)?.loadComponent).toBeDefined();
    }
  });

  it('loads the administration lazily, for whoever may use any of it', () => {
    const route = (routes[0].children ?? []).find((r) => r.path === 'admin');

    expect(route?.loadChildren).toBeDefined();
    expect(route?.canMatch).toHaveLength(1);
  });

  it('guards each validation queue by its own permission', () => {
    const children = routes[0].children ?? [];
    for (const kind of ['clinical', 'translation', 'audio']) {
      const route = children.find((r) => r.path === `validation/${kind}`);
      expect(route?.canMatch).toHaveLength(1);
      expect(route?.data?.['kind']).toBe(kind);
    }
  });
});
