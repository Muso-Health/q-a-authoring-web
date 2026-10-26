import { DOCUMENT, InjectionToken, inject, type Signal } from '@angular/core';

/** French first: it is the default and the fallback. */
export const UI_LANGUAGES = ['fr', 'en'] as const;
export type UiLanguage = (typeof UI_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: UiLanguage = 'fr';

export function isUiLanguage(value: string): value is UiLanguage {
  return (UI_LANGUAGES as readonly string[]).includes(value);
}

/** What a language is called in its own language — never translated, by definition. */
export const LANGUAGE_ENDONYMS: Record<UiLanguage, string> = {
  fr: 'Français',
  en: 'English',
};

/** Where the chosen language is remembered between loads. */
export const LANGUAGE_STORAGE_KEY = 'qa-authoring.language';

/**
 * The storage the choice is remembered in: `localStorage`, or nothing where the browser refuses
 * it (a locked-down or private window) — the switch then lasts the session only. Tests pass their
 * own, so no test reads or leaves a choice in the browser's.
 */
export const UI_LANGUAGE_STORAGE = new InjectionToken<Storage | null>('UI_LANGUAGE_STORAGE', {
  providedIn: 'root',
  factory: () => {
    try {
      return inject(DOCUMENT).defaultView?.localStorage ?? null;
    } catch {
      return null;
    }
  },
});

/**
 * Translation, as TypeScript asks for it. Templates use Transloco's pipe/directive directly
 * (accepted platform coupling); code goes through here. `t()` reads `language`, so a computed
 * calling it re-translates on a switch.
 */
export abstract class Translator {
  abstract readonly language: Signal<UiLanguage>;
  /** Whether the bundle for `language` has arrived; until then `t()` can only echo keys. */
  abstract readonly ready: Signal<boolean>;
  /** Switch, live, and remember the choice for the next load. */
  abstract use(language: UiLanguage): void;
  /** The words for a key; a missing key returns the key itself. */
  abstract t(key: string, params?: Record<string, unknown>): string;

  /** The `{ one, other, … }` branch a count needs in the active language, via `Intl.PluralRules`. */
  plural(key: string, count: number, params: Record<string, unknown> = {}): string {
    const category = new Intl.PluralRules(this.language()).select(count);
    const withCount = { count, ...params };
    const words = this.t(`${key}.${category}`, withCount);
    return words === `${key}.${category}` ? this.t(`${key}.other`, withCount) : words;
  }
}
