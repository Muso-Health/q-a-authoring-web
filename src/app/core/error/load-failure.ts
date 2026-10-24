import { HttpErrorResponse } from '@angular/common/http';

export type LoadFailure = 'not-found' | 'forbidden' | 'unreachable' | 'unexpected';

/** What a failed read means to the reader. Every `*_not_found` code the engine sends is a 404. */
export function loadFailureOf(error: unknown): LoadFailure {
  if (!(error instanceof HttpErrorResponse)) return 'unexpected';
  if (error.status === 404) return 'not-found';
  if (error.status === 401 || error.status === 403) return 'forbidden';
  if (error.status === 0 || error.status === 502 || error.status === 503 || error.status === 504) {
    return 'unreachable';
  }
  return 'unexpected';
}
