import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { MemoryStorage } from './testing/memory-storage';
import { provideTestI18n } from './testing/provide-test-i18n';
import { browserLanguages } from './transloco-translator';
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  Translator,
  UI_LANGUAGES,
  detectUiLanguage,
} from './translator';

const ROOT = process.cwd();
const read = (language: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(ROOT, `public/i18n/${language}.json`), 'utf8'));

function leaves(value: unknown, prefix = ''): [string, string][] {
  if (typeof value === 'string') return [[prefix, value]];
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    leaves(child, prefix === '' ? key : `${prefix}.${key}`),
  );
}

const placeholdersIn = (value: string): string =>
  [...value.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)]
    .map((match) => match[1])
    .sort()
    .join();

describe('the default language', () => {
  it('is French', () => {
    expect(DEFAULT_LANGUAGE).toBe('fr');
    expect([...UI_LANGUAGES]).toEqual(['fr', 'en']);
  });

  it('resolves a key in French', () => {
    TestBed.configureTestingModule({ providers: [provideTestI18n()] });
    const translator = TestBed.inject(Translator);

    expect(translator.language()).toBe('fr');
    expect(translator.t('app.name')).toBe('Muso Questions-Réponses');
  });

  it('resolves the same key in English when asked', () => {
    TestBed.configureTestingModule({ providers: [provideTestI18n('en')] });

    expect(TestBed.inject(Translator).t('app.name')).toBe('Muso Q&A Authoring');
  });

  it('returns the key itself when it is missing', () => {
    TestBed.configureTestingModule({ providers: [provideTestI18n()] });

    expect(TestBed.inject(Translator).t('no.such.key')).toBe('no.such.key');
  });
});

describe('language detection', () => {
  it('matches on the primary subtag', () => {
    expect(detectUiLanguage(['fr-ML'])).toBe('fr');
    expect(detectUiLanguage(['en-GB'])).toBe('en');
    expect(detectUiLanguage(['bm', 'en-US', 'fr'])).toBe('en');
  });

  it('falls back to French for every other locale, or none', () => {
    for (const other of ['es-ES', 'de', 'bm', 'ar']) {
      expect(detectUiLanguage([other])).toBe('fr');
    }
    expect(detectUiLanguage([])).toBe('fr');
    expect(detectUiLanguage(undefined)).toBe('fr');
  });

  it('reads the browser ordered list, then its single language', () => {
    expect(browserLanguages({ languages: ['es', 'en-GB'], language: 'es' })).toEqual([
      'es',
      'en-GB',
    ]);
    expect(browserLanguages({ languages: [], language: 'en-US' })).toEqual(['en-US']);
    expect(browserLanguages({ languages: [], language: '' })).toBeUndefined();
  });
});

describe('the remembered choice', () => {
  const start = (storage: Storage | null, browser: 'fr' | 'en' = 'fr') => {
    TestBed.configureTestingModule({ providers: [provideTestI18n(browser, storage)] });
    return TestBed.inject(Translator);
  };

  it('is written down on a switch, and only then', () => {
    const storage = new MemoryStorage();
    const translator = start(storage);
    expect(storage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();

    translator.use('en');

    expect(storage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
  });

  it('is restored on the next load, over what the browser asks for', () => {
    const storage = new MemoryStorage();
    storage.setItem(LANGUAGE_STORAGE_KEY, 'en');

    const translator = start(storage, 'fr');

    expect(translator.language()).toBe('en');
    expect(TestBed.inject(TranslocoService).getActiveLang()).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('is ignored when it names a language this application does not speak', () => {
    const storage = new MemoryStorage();
    storage.setItem(LANGUAGE_STORAGE_KEY, 'es');

    expect(start(storage, 'fr').language()).toBe('fr');
  });

  it('defaults to French when nothing is remembered and the browser offers nothing we speak', () => {
    expect(start(new MemoryStorage(), 'fr').language()).toBe('fr');
  });

  it('still switches where the browser refuses storage', () => {
    const refusing = new MemoryStorage();
    refusing.getItem = () => {
      throw new DOMException('denied', 'SecurityError');
    };
    refusing.setItem = refusing.getItem;
    const translator = start(refusing);

    expect(translator.language()).toBe('fr');
    translator.use('en');
    expect(translator.language()).toBe('en');
  });

  it('works with no storage at all', () => {
    const translator = start(null);
    translator.use('en');
    expect(translator.language()).toBe('en');
  });
});

describe('the translation files', () => {
  const fr = leaves(read('fr'));
  const en = leaves(read('en'));

  it('carry the same keys in both languages', () => {
    expect(fr.map(([key]) => key).sort()).toEqual(en.map(([key]) => key).sort());
  });

  it('leave nothing empty', () => {
    expect([...fr, ...en].filter(([, value]) => value.trim() === '')).toEqual([]);
  });

  it('ask for the same interpolations in both languages', () => {
    const english = new Map(en);
    const mismatched = fr.filter(
      ([key, value]) => placeholdersIn(value) !== placeholdersIn(english.get(key) ?? ''),
    );
    expect(mismatched).toEqual([]);
  });
});
