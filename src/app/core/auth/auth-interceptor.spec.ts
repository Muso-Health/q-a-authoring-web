import { signal } from '@angular/core';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../api/api-base-url';
import { authInterceptor } from './auth-interceptor';
import { AuthPort } from './auth-port';
import { provideAuth } from './provide-auth';

const API = 'https://api.test';

function setUp(email = 'author@example.org', baseUrl = API) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
      { provide: API_BASE_URL, useValue: baseUrl },
      provideAuth({ provider: 'dev', email }),
    ],
  });
  return { http: TestBed.inject(HttpClient), controller: TestBed.inject(HttpTestingController) };
}

const settle = () => new Promise<void>((resolve) => setTimeout(resolve));

describe('authInterceptor', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('sends the dev identity as X-Dev-User to the API', async () => {
    const { http, controller } = setUp();

    http.get(`${API}/me`).subscribe();
    await settle();

    const request = controller.expectOne(`${API}/me`);
    expect(request.request.headers.get('X-Dev-User')).toBe('author@example.org');
    request.flush({});
  });

  it('never sends the identity to another origin', async () => {
    const { http, controller } = setUp();

    http.get('/i18n/fr.json').subscribe();
    http.get('https://api.test.evil.example/me').subscribe();
    await settle();

    for (const url of ['/i18n/fr.json', 'https://api.test.evil.example/me']) {
      const request = controller.expectOne(url);
      expect(request.request.headers.has('X-Dev-User')).toBe(false);
      request.flush({});
    }
  });

  it('sends no header when no dev email is configured', async () => {
    const { http, controller } = setUp('  ');

    http.get(`${API}/me`).subscribe();
    await settle();

    const request = controller.expectOne(`${API}/me`);
    expect(request.request.headers.has('X-Dev-User')).toBe(false);
    request.flush({});
  });

  it('scopes by path prefix when the API sits behind a path on this origin', async () => {
    const { http, controller } = setUp('author@example.org', '/api');

    http.get('/api/me').subscribe();
    http.get('/apidocs').subscribe();
    await settle();

    expect(controller.expectOne('/api/me').request.headers.has('X-Dev-User')).toBe(true);
    expect(controller.expectOne('/apidocs').request.headers.has('X-Dev-User')).toBe(false);
    controller.match(() => true).forEach((request) => request.flush({}));
  });
});

/** The port as the Entra adapter answers it, without MSAL: a bearer, and a re-auth to observe. */
class BearerPort extends AuthPort {
  readonly photo = signal<string | null>(null);
  readonly reauthentications: number[] = [];
  async authHeaders() {
    return { Authorization: 'Bearer engine-token' };
  }
  async reauthenticate() {
    this.reauthentications.push(1);
  }
  async signOut() {}
}

function setUpBearer() {
  const port = new BearerPort();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
      { provide: API_BASE_URL, useValue: API },
      { provide: AuthPort, useValue: port },
    ],
  });
  return {
    port,
    http: TestBed.inject(HttpClient),
    controller: TestBed.inject(HttpTestingController),
  };
}

describe('authInterceptor — a bearer token (Entra)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('attaches the token as a Bearer to engine calls only', async () => {
    const { http, controller } = setUpBearer();
    http.get(`${API}/me`).subscribe();
    http.get('/i18n/fr.json').subscribe();
    http.get('https://api.test.evil.example/me').subscribe();
    await settle();

    expect(controller.expectOne(`${API}/me`).request.headers.get('Authorization')).toBe(
      'Bearer engine-token',
    );
    for (const url of ['/i18n/fr.json', 'https://api.test.evil.example/me']) {
      expect(controller.expectOne(url).request.headers.has('Authorization')).toBe(false);
    }
    controller.match(() => true).forEach((request) => request.flush({}));
  });

  it('re-authenticates when the engine answers 401, and still reports the refusal', async () => {
    const { http, controller, port } = setUpBearer();
    let failed: unknown = null;
    http.get(`${API}/me`).subscribe({ error: (error: unknown) => (failed = error) });
    await settle();

    controller
      .expectOne(`${API}/me`)
      .flush({ error: { code: 'unauthenticated' } }, { status: 401, statusText: 'Unauthorized' });
    await settle();

    expect(port.reauthentications).toHaveLength(1);
    expect((failed as { status?: number } | null)?.status).toBe(401);
  });

  it('leaves other refusals, and other origins’ 401s, alone', async () => {
    const { http, controller, port } = setUpBearer();
    http.get(`${API}/qasets/x`).subscribe({ error: () => undefined });
    http.get('https://elsewhere.example/thing').subscribe({ error: () => undefined });
    await settle();

    controller.expectOne(`${API}/qasets/x`).flush(null, { status: 403, statusText: 'Forbidden' });
    controller
      .expectOne('https://elsewhere.example/thing')
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    await settle();

    expect(port.reauthentications).toEqual([]);
  });
});
