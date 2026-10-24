import { DOCUMENT, Service, effect, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import {
  Translator,
  UI_LANGUAGE_CANDIDATES,
  detectUiLanguage,
  isUiLanguage,
  type UiLanguage,
} from './translator';

/** The browser's ordered language list, or its single language when the list is empty. */
export function browserLanguages(
  browser: Pick<Navigator, 'languages' | 'language'> | undefined = globalThis.navigator,
): readonly string[] | undefined {
  if (browser === undefined) return undefined;
  if (browser.languages !== undefined && browser.languages.length > 0) return browser.languages;
  return browser.language ? [browser.language] : undefined;
}

/**
 * Transloco behind `Translator`. The signal is the source of truth and is pushed one way into the
 * library and `<html lang>`; nothing else in TypeScript imports `@jsverse/transloco`.
 */
@Service()
export class TranslocoTranslator extends Translator {
  readonly #transloco = inject(TranslocoService);
  readonly #document = inject(DOCUMENT);

  readonly #language = signal<UiLanguage>(
    detectUiLanguage(inject(UI_LANGUAGE_CANDIDATES, { optional: true }) ?? browserLanguages()),
  );
  readonly language = this.#language.asReadonly();

  readonly #ready = signal(false);
  readonly ready = this.#ready.asReadonly();

  constructor() {
    super();
    // Deferred: the load event can fire mid-render, where writing a signal throws NG0600.
    this.#transloco.events$.subscribe((event) => {
      if (event.type === 'translationLoadSuccess') queueMicrotask(() => this.#ready.set(true));
    });
    // Synchronously first, so the first paint is already in the detected language.
    this.#apply(this.#language());
    effect(() => this.#apply(this.#language()));
  }

  use(language: UiLanguage): void {
    if (isUiLanguage(language)) this.#language.set(language);
  }

  t(key: string, params?: Record<string, unknown>): string {
    // Both reads register dependencies for callers in a computed; `translate()` notifies nobody.
    const language = this.#language();
    this.#ready();
    return this.#transloco.translate(key, params, language) || key;
  }

  #apply(language: UiLanguage): void {
    this.#transloco.setActiveLang(language);
    this.#document.documentElement.lang = language;
  }
}
