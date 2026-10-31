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
  language_not_in_project: 'authoring.errors.languageNotInProject',
  base_language_required: 'authoring.errors.baseLanguageRequired',
  answer_already_exists: 'authoring.errors.answerAlreadyExists',
  base_qaset_not_removable: 'authoring.errors.baseQASetNotRemovable',
  not_base_language: 'authoring.errors.notBaseLanguage',
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
  project_has_protocols: 'admin.errors.projectHasProtocols',
  protocol_has_themes: 'admin.errors.protocolHasThemes',
  theme_has_concepts: 'admin.errors.themeHasConcepts',
  unknown_base_language: 'admin.errors.unknownBaseLanguage',
  invalid_language_code: 'admin.errors.invalidLanguageCode',
  invalid_language_name: 'admin.errors.invalidLanguageName',
  language_code_already_exists: 'admin.errors.languageCodeExists',
  language_in_use: 'admin.errors.languageInUse',
  intent_in_use: 'admin.errors.intentInUse',
  category_in_use: 'admin.errors.categoryInUse',
  voice_in_use: 'admin.errors.voiceInUse',
  base_language_not_removable: 'admin.errors.baseLanguageNotRemovable',
  language_in_use_in_project: 'admin.errors.languageInUseInProject',
  language_is_code_switching_component: 'admin.errors.languageIsCodeSwitchingComponent',
  code_switching_language_exists: 'admin.errors.codeSwitchingLanguageExists',
  invalid_code_switching_components: 'admin.errors.invalidCodeSwitchingComponents',
  code_switching_components_not_in_project: 'admin.errors.codeSwitchingComponentsNotInProject',
  code_switching_without_base_language: 'admin.errors.codeSwitchingWithoutBaseLanguage',
  code_switching_base_language: 'admin.errors.codeSwitchingBaseLanguage',
  invalid_glossary_field: 'admin.errors.invalidGlossaryField',
  unsupported_document_type: 'documentation.errors.unsupportedType',
  document_too_large: 'documentation.errors.tooLarge',
  no_documentation: 'documentation.errors.noDocumentation',
  completeness_engine_error: 'documentation.errors.completenessEngine',
};

/** Not-found codes worth naming: the view is stale all the same, but the reader is told what went. */
const GONE_BY_CODE: Readonly<Record<string, string>> = {
  role_not_found: 'admin.errors.roleNotFound',
  project_not_found: 'admin.errors.projectNotFound',
  language_not_found: 'admin.errors.languageNotFound',
  project_language_not_found: 'admin.errors.projectLanguageNotFound',
  voice_not_found: 'admin.errors.voiceNotFound',
  assignment_not_found: 'admin.errors.assignmentNotFound',
  glossary_term_not_found: 'admin.errors.glossaryTermNotFound',
  glossary_form_not_found: 'admin.errors.glossaryFormNotFound',
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
  if (code !== undefined && code in GONE_BY_CODE) return failure(GONE_BY_CODE[code], true);
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

/** The rows (indices in the batch as sent) the engine refused as an incomplete pair. */
export function invalidPairRowsOf(error: unknown): number[] | null {
  if (!(error instanceof HttpErrorResponse) || engineCode(error) !== 'invalid_qa_pairs') {
    return null;
  }
  const rows = (error.error as { details?: { rows?: unknown } | null }).details?.rows;
  return Array.isArray(rows) ? rows.filter((row): row is number => Number.isInteger(row)) : [];
}

/** The engine's own refusal of a malformed request (a schema violation, e.g. too large a batch). */
export function isInvalidRequest(error: unknown): boolean {
  return error instanceof HttpErrorResponse && engineCode(error) === 'invalid_request';
}
