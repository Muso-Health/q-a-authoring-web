import { DOCUMENT, Service, effect, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  Translator,
  UI_LANGUAGE_STORAGE,
  isUiLanguage,
  type UiLanguage,
} from './translator';

/**
 * Transloco behind `Translator`. The signal is the source of truth and is pushed one way into the
 * library and `<html lang>`; nothing else in TypeScript imports `@jsverse/transloco`.
 *
 * The first language is the one last chosen, if any; else French — the browser's language is
 * not consulted. A switch is written to storage, so it survives a reload. (budgetisation
 * remembers nothing and detects from the browser on every load; here the choice is asked to
 * stick, and the default is the product's.)
 */
@Service()
export class TranslocoTranslator extends Translator {
  readonly #transloco = inject(TranslocoService);
  readonly #document = inject(DOCUMENT);
  readonly #storage = inject(UI_LANGUAGE_STORAGE);

  readonly #language = signal<UiLanguage>(this.#remembered() ?? DEFAULT_LANGUAGE);
  readonly language = this.#language.asReadonly();

  readonly #ready = signal(false);
  readonly ready = this.#ready.asReadonly();

  constructor() {
    super();
    // Deferred: the load event can fire mid-render, where writing a signal throws NG0600.
    this.#transloco.events$.subscribe((event) => {
      if (event.type === 'translationLoadSuccess') queueMicrotask(() => this.#ready.set(true));
    });
    // Synchronously first, so the first paint is already in the starting language.
    this.#apply(this.#language());
    effect(() => this.#apply(this.#language()));
  }

  use(language: UiLanguage): void {
    if (!isUiLanguage(language)) return;
    this.#language.set(language);
    try {
      this.#storage?.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // Refused storage: the switch still applies, for this session.
    }
  }

  t(key: string, params?: Record<string, unknown>): string {
    // Both reads register dependencies for callers in a computed; `translate()` notifies nobody.
    const language = this.#language();
    this.#ready();
    return this.#transloco.translate(key, params, language) || key;
  }

  #remembered(): UiLanguage | null {
    try {
      const stored = this.#storage?.getItem(LANGUAGE_STORAGE_KEY) ?? null;
      return stored !== null && isUiLanguage(stored) ? stored : null;
    } catch {
      return null;
    }
  }

  #apply(language: UiLanguage): void {
    this.#transloco.setActiveLang(language);
    this.#document.documentElement.lang = language;
  }
}
