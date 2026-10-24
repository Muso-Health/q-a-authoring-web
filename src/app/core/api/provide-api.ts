import type { Provider } from '@angular/core';
import { API_BASE_URL } from './api-base-url';
import { ApiPort } from './api-port';
import { HttpApiAdapter } from './http-api-adapter';

export function provideApi(baseUrl: string): Provider[] {
  return [
    { provide: API_BASE_URL, useValue: baseUrl },
    { provide: ApiPort, useClass: HttpApiAdapter },
  ];
}
