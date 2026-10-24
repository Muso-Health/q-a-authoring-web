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

  it('lands on the engine status inside the shell, lazily', () => {
    const [shell] = routes;
    const children = shell.children ?? [];

    expect(shell.path).toBe('');
    expect(children.find((route) => route.path === '')?.redirectTo).toBe('status');
    expect(children.find((route) => route.path === 'status')?.loadComponent).toBeDefined();
  });
});
