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
  same_language: 'authoring.errors.sameLanguage',
  unknown_engine: 'authoring.errors.unknownEngine',
  unsupported_language_for_engine: 'authoring.errors.unsupportedLanguageForEngine',
  translation_engine_error: 'authoring.errors.translationEngine',
  generation_engine_error: 'authoring.errors.generationEngine',
  link_already_exists: 'authoring.errors.linkAlreadyExists',
  self_link: 'authoring.errors.selfLink',
  invalid_name: 'authoring.errors.invalidName',
  unsupported_audio_type: 'authoring.errors.unsupportedAudioType',
  audio_too_large: 'authoring.errors.audioTooLarge',
  no_base_language_presence: 'validation.errors.noBaseLanguage',
  not_a_translation: 'validation.errors.notATranslation',
  invalid_decision: 'validation.errors.invalidDecision',
  email_already_exists: 'admin.errors.emailExists',
  invalid_email: 'admin.errors.invalidEmail',
  role_name_exists: 'admin.errors.roleNameExists',
  role_in_use: 'admin.errors.roleInUse',
  unknown_permission: 'admin.errors.unknownPermission',
  invalid_prompt_template: 'admin.errors.invalidPromptTemplate',
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

/** The placeholders a refused prompt template is missing or should not have. */
export interface PlaceholderProblems {
  readonly missing: readonly string[];
  readonly unknown: readonly string[];
}

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

export function placeholderProblemsOf(error: unknown): PlaceholderProblems | null {
  if (!(error instanceof HttpErrorResponse) || engineCode(error) !== 'invalid_prompt_template') {
    return null;
  }
  const body = error.error as { details?: { missing?: unknown; unknown?: unknown } | null };
  return { missing: strings(body.details?.missing), unknown: strings(body.details?.unknown) };
}
