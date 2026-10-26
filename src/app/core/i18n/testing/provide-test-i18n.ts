import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  inject,
  provideEnvironmentInitializer,
  type EnvironmentProviders,
  type Provider,
} from '@angular/core';
import {
  TranslocoService,
  provideTransloco,
  type Translation,
  type TranslocoLoader,
} from '@jsverse/transloco';
import { of } from 'rxjs';
import {
  DEFAULT_LANGUAGE,
  Translator,
  UI_LANGUAGES,
  LANGUAGE_STORAGE_KEY,
  UI_LANGUAGE_STORAGE,
  type UiLanguage,
} from '../translator';
import { TranslocoTranslator } from '../transloco-translator';
import { MemoryStorage } from './memory-storage';

/** The real `public/i18n/*.json`, read synchronously, so tests assert what users read. */
class DiskLoader implements TranslocoLoader {
  getTranslation(language: string) {
    const path = join(process.cwd(), `public/i18n/${language}.json`);
    return of(JSON.parse(readFileSync(path, 'utf8')) as Translation);
  }
}

/** A fresh in-memory storage in which `language` is the saved choice. */
function savedAs(language: UiLanguage): Storage {
  const storage = new MemoryStorage();
  storage.setItem(LANGUAGE_STORAGE_KEY, language);
  return storage;
}

/**
 * French by default. A test asks for English the way a person gets it — as the saved choice —
 * in a fresh in-memory storage per call, so a test that switches language never hands its choice
 * to the next. A test that passes its own storage starts in whatever that storage holds.
 */
export function provideTestI18n(
  language: UiLanguage = DEFAULT_LANGUAGE,
  storage: Storage | null = savedAs(language),
): (Provider | EnvironmentProviders)[] {
  return [
    { provide: UI_LANGUAGE_STORAGE, useValue: storage },
    ...provideTransloco({
      config: {
        availableLangs: [...UI_LANGUAGES],
        defaultLang: DEFAULT_LANGUAGE,
        fallbackLang: DEFAULT_LANGUAGE,
        reRenderOnLangChange: true,
        prodMode: false,
        missingHandler: { allowEmpty: false, useFallbackTranslation: true, logMissingKey: false },
      },
      loader: DiskLoader,
    }),
    { provide: Translator, useClass: TranslocoTranslator },
    provideEnvironmentInitializer(() => void inject(Translator)),
    // Loaded up front, so `t()` called outside a template sees words rather than keys.
    provideEnvironmentInitializer(() => {
      const transloco = inject(TranslocoService);
      transloco.load(transloco.getActiveLang()).subscribe();
    }),
  ];
}
