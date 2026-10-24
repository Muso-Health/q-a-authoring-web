import { HttpErrorResponse } from '@angular/common/http';

export interface WriteFailure {
  /** The i18n key of the message to show. */
  readonly key: string;
  /** The target no longer exists, so the view is stale and must be re-read. */
  readonly gone: boolean;
}

const BY_CODE: Readonly<Record<string, string>> = {
  invalid_text: 'authoring.errors.invalidText',
  language_already_present: 'authoring.errors.languageAlreadyPresent',
  language_presence_required: 'authoring.errors.languagePresenceRequired',
  unknown_language: 'authoring.errors.unknownLanguage',
};

const engineCode = (error: HttpErrorResponse): string | undefined => {
  const body: unknown = error.error;
  return typeof body === 'object' &&
    body !== null &&
    'code' in body &&
    typeof body.code === 'string'
    ? body.code
    : undefined;
};

/** What a refused write means to the author: by the engine's code first, by status otherwise. */
export function writeFailureOf(error: unknown): WriteFailure {
  const failure = (key: string, gone = false): WriteFailure => ({ key, gone });
  if (!(error instanceof HttpErrorResponse)) return failure('authoring.errors.unexpected');

  const code = engineCode(error);
  if (code !== undefined && code in BY_CODE) return failure(BY_CODE[code]);
  if (error.status === 404) return failure('authoring.errors.gone', true);
  if (error.status === 422) return failure('authoring.errors.invalidInput');
  if (error.status === 401 || error.status === 403) return failure('authoring.errors.forbidden');
  if (error.status === 0 || error.status === 502 || error.status === 503 || error.status === 504) {
    return failure('authoring.errors.unreachable');
  }
  return failure('authoring.errors.unexpected');
}
