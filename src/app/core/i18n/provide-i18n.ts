import {
  inject,
  isDevMode,
  provideEnvironmentInitializer,
  type EnvironmentProviders,
  type Provider,
} from '@angular/core';
import { provideTransloco } from '@jsverse/transloco';
import { TranslocoHttpLoader } from './transloco-http-loader';
import { DEFAULT_LANGUAGE, Translator, UI_LANGUAGES } from './translator';
import { TranslocoTranslator } from './transloco-translator';

export function provideI18n(): (Provider | EnvironmentProviders)[] {
  // Spread, not wrapped in `makeEnvironmentProviders`: nesting drops some of Transloco's providers.
  return [
    ...provideTransloco({
      config: {
        availableLangs: [...UI_LANGUAGES],
        defaultLang: DEFAULT_LANGUAGE,
        fallbackLang: DEFAULT_LANGUAGE,
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
        missingHandler: {
          allowEmpty: false,
          useFallbackTranslation: true,
          logMissingKey: isDevMode(),
        },
      },
      loader: TranslocoHttpLoader,
    }),
    { provide: Translator, useClass: TranslocoTranslator },
    // Eager: templates reach Transloco directly, so nothing else would construct the adapter
    // and apply the detected language.
    provideEnvironmentInitializer(() => void inject(Translator)),
  ];
}
