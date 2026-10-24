import type { HttpInterceptorFn } from '@angular/common/http';
import { DOCUMENT, inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { API_BASE_URL } from '../api/api-base-url';
import { targetsApi } from '../api/targets-api';
import { AuthPort } from './auth-port';

/** Attaches the caller's identity to engine calls only — never to another origin or path. */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (!targetsApi(request.url, inject(API_BASE_URL), inject(DOCUMENT).baseURI)) {
    return next(request);
  }

  return from(inject(AuthPort).authHeaders()).pipe(
    switchMap((headers) => next(request.clone({ setHeaders: { ...headers } }))),
  );
};
