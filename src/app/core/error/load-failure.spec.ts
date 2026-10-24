import { HttpErrorResponse } from '@angular/common/http';
import { engineError } from '../api/testing/fake-api-port';
import { loadFailureOf } from './load-failure';

describe('loadFailureOf', () => {
  it('classifies the engine’s answers by status', () => {
    expect(loadFailureOf(engineError(404, 'theme_not_found'))).toBe('not-found');
    expect(loadFailureOf(engineError(401, 'unauthenticated'))).toBe('forbidden');
    expect(loadFailureOf(engineError(403, 'permission_denied'))).toBe('forbidden');
    expect(loadFailureOf(engineError(500, 'internal'))).toBe('unexpected');
  });

  it('reads a network failure or an unavailable engine as unreachable', () => {
    expect(loadFailureOf(new HttpErrorResponse({ status: 0 }))).toBe('unreachable');
    expect(loadFailureOf(new HttpErrorResponse({ status: 503 }))).toBe('unreachable');
  });

  it('reads anything else as unexpected', () => {
    expect(loadFailureOf(new Error('boom'))).toBe('unexpected');
    expect(loadFailureOf(undefined)).toBe('unexpected');
  });
});
