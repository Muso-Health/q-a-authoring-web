import { HttpErrorResponse } from '@angular/common/http';
import { ApiPort } from '../api-port';

/** An `ApiPort` answering reads from a path → body table; an unknown path rejects with a 503. */
export class FakeApiPort extends ApiPort {
  readonly reads: string[] = [];
  readonly writes: { method: string; path: string; body?: unknown }[] = [];

  constructor(private readonly answers: Readonly<Record<string, unknown>>) {
    super();
  }

  get<T>(path: string): Promise<T> {
    this.reads.push(path);
    return path in this.answers
      ? Promise.resolve(this.answers[path] as T)
      : Promise.reject(new HttpErrorResponse({ status: 503, url: path }));
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
