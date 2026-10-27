import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { MemoryStorage } from './testing/memory-storage';
import { SPANISH } from './testing/spanish';
import { provideTestI18n } from './testing/provide-test-i18n';
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, Translator, UI_LANGUAGES } from './translator';

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

describe('the starting language: the saved choice, else French', () => {
  const start = (storage: Storage | null) => {
    TestBed.configureTestingModule({ providers: [provideTestI18n(DEFAULT_LANGUAGE, storage)] });
    return TestBed.inject(Translator);
  };

  /** The browser as an anglophone's: every way it can say so says English. */
  const browserInEnglish = () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US', 'en']);
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-US');
  };
  afterEach(() => vi.restoreAllMocks());

  it('is French when nothing is saved, whatever language the browser asks for', () => {
    browserInEnglish();

    const translator = start(new MemoryStorage());

    expect(translator.language()).toBe('fr');
    expect(TestBed.inject(TranslocoService).getActiveLang()).toBe('fr');
    expect(document.documentElement.lang).toBe('fr');
  });

  it('is written down on a switch, and only then', () => {
    const storage = new MemoryStorage();
    const translator = start(storage);
    expect(storage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();

    translator.use('en');

    expect(storage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
  });

  it('is the saved choice when there is one', () => {
    const storage = new MemoryStorage();
    storage.setItem(LANGUAGE_STORAGE_KEY, 'en');

    const translator = start(storage);

    expect(translator.language()).toBe('en');
    expect(TestBed.inject(TranslocoService).getActiveLang()).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('is ignored when it names a language this application does not speak', () => {
    const storage = new MemoryStorage();
    storage.setItem(LANGUAGE_STORAGE_KEY, 'es');

    browserInEnglish();
    expect(start(storage).language()).toBe('fr');
  });

  it('is French, and still switches, where the browser refuses storage', () => {
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

  it('is French, and still switches, with no storage at all', () => {
    browserInEnglish();
    const translator = start(null);
    expect(translator.language()).toBe('fr');
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

  it('speak French and English only, never Spanish', () => {
    expect([...fr, ...en].filter(([, value]) => SPANISH.test(value))).toEqual([]);
  });
});
