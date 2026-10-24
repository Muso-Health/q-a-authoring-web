import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { authInterceptor } from '../auth/auth-interceptor';
import { provideAuth } from '../auth/provide-auth';
import { ApiPort } from './api-port';
import { provideApi } from './provide-api';

const API = 'https://api.test';

function setUp(baseUrl = API) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
      provideApi(baseUrl),
      provideAuth({ provider: 'dev', email: 'author@example.org' }),
    ],
  });
  return { api: TestBed.inject(ApiPort), http: TestBed.inject(HttpTestingController) };
}

/** The interceptor awaits the auth port, so the request is only issued after a microtask. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve));

describe('HttpApiAdapter', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('sends a read to the configured base URL and resolves with the body', async () => {
    const { api, http } = setUp();

    const health = api.get<{ status: string }>('/health');
    await settle();
    const request = http.expectOne(`${API}/health`);
    expect(request.request.method).toBe('GET');
    request.flush({ status: 'ok' });

    await expect(health).resolves.toEqual({ status: 'ok' });
  });

  it('attaches the dev identity header through the interceptor', async () => {
    const { api, http } = setUp();

    void api.get('/me');
    await settle();

    const request = http.expectOne(`${API}/me`);
    expect(request.request.headers.get('X-Dev-User')).toBe('author@example.org');
    request.flush({});
  });

  it('tolerates a trailing slash on the base URL', async () => {
    const { api, http } = setUp(`${API}/`);

    void api.get('/health');
    await settle();

    http.expectOne(`${API}/health`).flush({});
  });

  it('passes query parameters on reads', async () => {
    const { api, http } = setUp();

    void api.get('/qasets', { params: { project_id: 'p1' } });
    await settle();

    http.expectOne(`${API}/qasets?project_id=p1`).flush({});
  });

  it('sends writes with their verb and body', async () => {
    const { api, http } = setUp();

    void api.post('/roles', { name: 'Author' });
    void api.put('/a', { x: 1 });
    void api.patch('/b', { y: 2 });
    void api.delete('/c');
    await settle();

    const post = http.expectOne(`${API}/roles`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ name: 'Author' });
    expect(post.request.headers.get('X-Dev-User')).toBe('author@example.org');
    expect(http.expectOne(`${API}/a`).request.method).toBe('PUT');
    expect(http.expectOne(`${API}/b`).request.method).toBe('PATCH');
    expect(http.expectOne(`${API}/c`).request.method).toBe('DELETE');
    http.match(() => true).forEach((request) => request.flush({}));
    post.flush({});
  });

  it('rejects when the API answers with an error', async () => {
    const { api, http } = setUp();

    const me = api.get('/me');
    await settle();
    http
      .expectOne(`${API}/me`)
      .flush({ code: 'unauthenticated' }, { status: 401, statusText: 'x' });

    await expect(me).rejects.toMatchObject({ status: 401 });
  });
});
