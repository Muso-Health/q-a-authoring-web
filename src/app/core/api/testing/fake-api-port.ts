import { HttpErrorResponse } from '@angular/common/http';
import { ApiPort } from '../api-port';

/**
 * An `ApiPort` answering from a table: reads by path (`/qasets/x`), writes by method and path
 * (`DELETE /qasets/x`). An answer that is an `HttpErrorResponse` rejects with it, a `Promise` is
 * returned as-is (to hold a call pending), anything else resolves. An unknown read rejects with a
 * 503; an unknown write resolves with nothing. The table is mutable, so a test can change what
 * the engine says next.
 */
export class FakeApiPort extends ApiPort {
  readonly answers: Record<string, unknown>;
  readonly reads: string[] = [];
  readonly writes: { method: string; path: string; body?: unknown }[] = [];
  /** Every call in order, as `METHOD path`. */
  readonly calls: string[] = [];

  constructor(answers: Readonly<Record<string, unknown>>) {
    super();
    this.answers = { ...answers };
  }

  get<T>(path: string): Promise<T> {
    this.reads.push(path);
    this.calls.push(`GET ${path}`);
    if (!(path in this.answers)) {
      return Promise.reject(new HttpErrorResponse({ status: 503, url: path }));
    }
    return this.#answer<T>(this.answers[path], undefined);
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
    this.calls.push(`${method} ${path}`);
    return this.#answer<T>(this.answers[`${method} ${path}`], body);
  }

  #answer<T>(answer: unknown, body: unknown): Promise<T> {
    if (typeof answer === 'function') return this.#answer<T>(answer(body), body);
    if (answer instanceof HttpErrorResponse) return Promise.reject(answer);
    return Promise.resolve(answer as T);
  }
}

/** The engine's error shape, at a status. */
export function engineError(status: number, code: string): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: { code, message: code, details: null } });
}
