import { HttpErrorResponse } from '@angular/common/http';
import { engineError } from '../api/testing/fake-api-port';
import { writeFailureOf } from './write-failure';

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

  it('reads every not-found code as the item being gone', () => {
    for (const code of ['variant_not_found', 'language_not_present', 'qaset_not_found']) {
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
