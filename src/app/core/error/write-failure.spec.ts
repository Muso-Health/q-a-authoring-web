import { HttpErrorResponse } from '@angular/common/http';
import { engineError } from '../api/testing/fake-api-port';
import {
  invalidPairRowsOf,
  isInvalidRequest,
  placeholderProblemsOf,
  writeFailureOf,
} from './write-failure';

describe('writeFailureOf', () => {
  it('reacts to the engine’s code, not its message', () => {
    expect(writeFailureOf(engineError(422, 'invalid_text'))).toEqual({
      key: 'authoring.errors.invalidText',
      gone: false,
    });
    expect(writeFailureOf(engineError(409, 'language_already_present')).key).toBe(
      'authoring.errors.languageAlreadyPresent',
    );
    expect(writeFailureOf(engineError(409, 'language_presence_required')).key).toBe(
      'authoring.errors.languagePresenceRequired',
    );
    expect(writeFailureOf(engineError(422, 'unknown_language')).key).toBe(
      'authoring.errors.unknownLanguage',
    );
  });

  it('maps the engine-assist refusals, the engines’ own failures included', () => {
    const cases: [number, string, string][] = [
      [422, 'same_language', 'authoring.errors.sameLanguage'],
      [422, 'unknown_engine', 'authoring.errors.unknownEngine'],
      [422, 'unsupported_language_for_engine', 'authoring.errors.unsupportedLanguageForEngine'],
      [502, 'translation_engine_error', 'authoring.errors.translationEngine'],
      [502, 'generation_engine_error', 'authoring.errors.generationEngine'],
    ];
    for (const [status, code, key] of cases) {
      expect(writeFailureOf(engineError(status, code))).toEqual({ key, gone: false });
    }
  });

  it('maps the concept and project-language refusals', () => {
    const cases: [number, string, string][] = [
      [422, 'language_not_in_project', 'authoring.errors.languageNotInProject'],
      [422, 'base_language_required', 'authoring.errors.baseLanguageRequired'],
      [409, 'answer_already_exists', 'authoring.errors.answerAlreadyExists'],
      [422, 'base_qaset_not_removable', 'authoring.errors.baseQASetNotRemovable'],
      [422, 'base_language_not_removable', 'admin.errors.baseLanguageNotRemovable'],
      [409, 'language_in_use_in_project', 'admin.errors.languageInUseInProject'],
      [409, 'theme_has_concepts', 'admin.errors.themeHasConcepts'],
      [409, 'voice_in_use', 'admin.errors.voiceInUse'],
    ];
    for (const [status, code, key] of cases) {
      expect(writeFailureOf(engineError(status, code))).toEqual({ key, gone: false });
    }
    expect(writeFailureOf(engineError(404, 'project_language_not_found')).gone).toBe(true);
    expect(writeFailureOf(engineError(404, 'voice_not_found')).gone).toBe(true);
    expect(writeFailureOf(engineError(404, 'concept_not_found')).gone).toBe(true);
  });

  it('maps the catalogue refusals', () => {
    expect(writeFailureOf(engineError(422, 'invalid_name')).key).toBe(
      'authoring.errors.invalidName',
    );
  });

  it('maps the audio refusals', () => {
    expect(writeFailureOf(engineError(422, 'unsupported_audio_type')).key).toBe(
      'authoring.errors.unsupportedAudioType',
    );
    expect(writeFailureOf(engineError(422, 'audio_too_large')).key).toBe(
      'authoring.errors.audioTooLarge',
    );
    expect(writeFailureOf(engineError(404, 'audio_not_found')).gone).toBe(true);
  });

  it('reads every not-found code as the item being gone', () => {
    for (const code of [
      'variant_not_found',
      'language_not_present',
      'qaset_not_found',
      'link_not_found',
      'intent_not_attached',
      'category_not_attached',
    ]) {
      expect(writeFailureOf(engineError(404, code))).toEqual({
        key: 'authoring.errors.gone',
        gone: true,
      });
    }
  });

  it('reads a request the engine could not parse as invalid input', () => {
    const fastapi = new HttpErrorResponse({ status: 422, error: { detail: [{ loc: ['body'] }] } });
    expect(writeFailureOf(fastapi).key).toBe('authoring.errors.invalidInput');
  });

  it('falls back by status for codes it does not know', () => {
    expect(writeFailureOf(engineError(403, 'permission_denied')).key).toBe(
      'authoring.errors.forbidden',
    );
    expect(writeFailureOf(new HttpErrorResponse({ status: 0 })).key).toBe(
      'authoring.errors.unreachable',
    );
    expect(writeFailureOf(engineError(500, 'boom')).key).toBe('authoring.errors.unexpected');
    expect(writeFailureOf(new Error('x')).key).toBe('authoring.errors.unexpected');
  });
});

describe('writeFailureOf, for the administration', () => {
  it('maps the access and prompt refusals', () => {
    const cases: [number, string, string][] = [
      [409, 'email_already_exists', 'admin.errors.emailExists'],
      [409, 'role_name_exists', 'admin.errors.roleNameExists'],
      [409, 'role_in_use', 'admin.errors.roleInUse'],
      [422, 'unknown_permission', 'admin.errors.unknownPermission'],
      [422, 'invalid_email', 'admin.errors.invalidEmail'],
      [422, 'invalid_prompt_template', 'admin.errors.invalidPromptTemplate'],
    ];
    for (const [status, code, key] of cases) {
      expect(writeFailureOf(engineError(status, code))).toEqual({ key, gone: false });
    }
  });

  it('treats a vanished user, role or template as gone', () => {
    for (const code of ['user_not_found', 'role_not_found', 'role_not_assigned']) {
      expect(writeFailureOf(engineError(404, code)).gone).toBe(true);
    }
  });

  it('says which part of a scoped assignment vanished, and re-reads', () => {
    for (const [code, key] of [
      ['role_not_found', 'admin.errors.roleNotFound'],
      ['project_not_found', 'admin.errors.projectNotFound'],
      ['language_not_found', 'admin.errors.languageNotFound'],
      ['assignment_not_found', 'admin.errors.assignmentNotFound'],
    ]) {
      expect(writeFailureOf(engineError(404, code))).toEqual({ key, gone: true });
    }
  });

  it('maps the glossary refusals: a blank field, a vanished term or form', () => {
    expect(writeFailureOf(engineError(422, 'invalid_glossary_field', { field: 'label' }))).toEqual({
      key: 'admin.errors.invalidGlossaryField',
      gone: false,
    });
    for (const [code, key] of [
      ['glossary_term_not_found', 'admin.errors.glossaryTermNotFound'],
      ['glossary_form_not_found', 'admin.errors.glossaryFormNotFound'],
    ]) {
      expect(writeFailureOf(engineError(404, code))).toEqual({ key, gone: true });
    }
  });
});

describe('placeholderProblemsOf', () => {
  it('reads the placeholders the engine says are missing or unknown', () => {
    const error = new HttpErrorResponse({
      status: 422,
      error: {
        code: 'invalid_prompt_template',
        message: 'm',
        details: { missing: ['text'], unknown: ['texte'] },
      },
    });

    expect(placeholderProblemsOf(error)).toEqual({ missing: ['text'], unknown: ['texte'] });
  });

  it('has nothing to say about any other refusal', () => {
    expect(placeholderProblemsOf(engineError(422, 'invalid_name'))).toBeNull();
    expect(placeholderProblemsOf(new Error('boom'))).toBeNull();
  });
});

describe('invalidPairRowsOf', () => {
  it('reads the rows the engine refused', () => {
    expect(invalidPairRowsOf(engineError(422, 'invalid_qa_pairs', { rows: [0, 2] }))).toEqual([
      0, 2,
    ]);
  });

  it('has nothing to say about any other refusal', () => {
    expect(invalidPairRowsOf(engineError(422, 'invalid_request'))).toBeNull();
    expect(invalidPairRowsOf(new Error('boom'))).toBeNull();
  });
});

describe('isInvalidRequest', () => {
  it('recognises the engine’s refusal of a malformed request, by its code', () => {
    expect(isInvalidRequest(engineError(422, 'invalid_request'))).toBe(true);
    expect(isInvalidRequest(engineError(422, 'invalid_qa_pairs'))).toBe(false);
    expect(isInvalidRequest(new Error('boom'))).toBe(false);
  });
});
