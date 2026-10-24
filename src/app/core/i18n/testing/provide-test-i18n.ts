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
  UI_LANGUAGE_CANDIDATES,
  type UiLanguage,
} from '../translator';
import { TranslocoTranslator } from '../transloco-translator';

/** The real `public/i18n/*.json`, read synchronously, so tests assert what users read. */
class DiskLoader implements TranslocoLoader {
  getTranslation(language: string) {
    const path = join(process.cwd(), `public/i18n/${language}.json`);
    return of(JSON.parse(readFileSync(path, 'utf8')) as Translation);
  }
}

/** Pinned to French by default — jsdom reports no languages, and French is the product default. */
export function provideTestI18n(
  language: UiLanguage = DEFAULT_LANGUAGE,
): (Provider | EnvironmentProviders)[] {
  return [
    { provide: UI_LANGUAGE_CANDIDATES, useValue: [language] },
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
