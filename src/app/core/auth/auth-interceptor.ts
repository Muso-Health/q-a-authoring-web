import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { DOCUMENT, inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { API_BASE_URL } from '../api/api-base-url';
import { targetsApi } from '../api/targets-api';
import { AuthPort } from './auth-port';

/**
 * Attaches the caller's identity to engine calls only — never to another origin or path: the dev
 * header, or Entra's `Authorization: Bearer`. When the engine refuses the caller (401), the port
 * is asked to re-authenticate, and the refusal still reaches the caller as it was.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (!targetsApi(request.url, inject(API_BASE_URL), inject(DOCUMENT).baseURI)) {
    return next(request);
  }
  const auth = inject(AuthPort);
  return from(auth.authHeaders()).pipe(
    switchMap((headers) => next(request.clone({ setHeaders: { ...headers } }))),
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }
      return from(auth.reauthenticate().catch(() => undefined)).pipe(
        switchMap(() => throwError(() => error)),
      );
    }),
  );
};
