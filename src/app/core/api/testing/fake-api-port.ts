import { HttpErrorResponse } from '@angular/common/http';
import { ApiPort } from '../api-port';

/**
 * An `ApiPort` answering reads from a path → answer table. An answer that is an
 * `HttpErrorResponse` rejects with it, a `Promise` is returned as-is (to hold a call pending),
 * anything else resolves. An unknown path rejects with a 503.
 */
export class FakeApiPort extends ApiPort {
  readonly reads: string[] = [];
  readonly writes: { method: string; path: string; body?: unknown }[] = [];

  constructor(private readonly answers: Readonly<Record<string, unknown>>) {
    super();
  }

  get<T>(path: string): Promise<T> {
    this.reads.push(path);
    if (!(path in this.answers)) {
      return Promise.reject(new HttpErrorResponse({ status: 503, url: path }));
    }
    const answer = this.answers[path];
    if (answer instanceof HttpErrorResponse) return Promise.reject(answer);
    return Promise.resolve(answer as T);
  }

  post<T>(path: string, body: unknown): Promise<T> {
    return this.#write('POST', path, body);
  }

  put<T>(path: string, body: unknown): Promise<T> {
    return this.#write('PUT', path, body);
  }

  patch<T>(path: string, body: unknown): Promise<T> {
    return this.#write('PATCH', path, body);
  }

  delete<T = void>(path: string): Promise<T> {
    return this.#write('DELETE', path);
  }

  #write<T>(method: string, path: string, body?: unknown): Promise<T> {
    this.writes.push({ method, path, body });
    return Promise.resolve(this.answers[path] as T);
  }
}

/** The engine's error shape, at a status. */
export function engineError(status: number, code: string): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: { code, message: code, details: null } });
}
