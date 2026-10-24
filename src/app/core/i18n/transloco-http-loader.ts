import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import type { Translation, TranslocoLoader } from '@jsverse/transloco';

/** `/i18n/{lang}.json`, served from this origin (`public/i18n/`). */
@Service()
export class TranslocoHttpLoader implements TranslocoLoader {
  readonly #http = inject(HttpClient);

  getTranslation(language: string) {
    return this.#http.get<Translation>(`/i18n/${language}.json`);
  }
}
