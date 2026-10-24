import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from './api-base-url';
import { ApiPort, type ReadOptions } from './api-port';

@Service()
export class HttpApiAdapter extends ApiPort {
  readonly #http = inject(HttpClient);
  readonly #baseUrl = inject(API_BASE_URL).replace(/\/+$/, '');

  get<T>(path: string, options?: ReadOptions): Promise<T> {
    return firstValueFrom(this.#http.get<T>(this.#url(path), { params: options?.params }));
  }

  post<T>(path: string, body: unknown): Promise<T> {
    return firstValueFrom(this.#http.post<T>(this.#url(path), body));
  }

  put<T>(path: string, body: unknown): Promise<T> {
    return firstValueFrom(this.#http.put<T>(this.#url(path), body));
  }

  patch<T>(path: string, body: unknown): Promise<T> {
    return firstValueFrom(this.#http.patch<T>(this.#url(path), body));
  }

  delete<T = void>(path: string): Promise<T> {
    return firstValueFrom(this.#http.delete<T>(this.#url(path)));
  }

  #url(path: string): string {
    return `${this.#baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }
}
