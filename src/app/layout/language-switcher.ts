import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  LANGUAGE_ENDONYMS,
  Translator,
  UI_LANGUAGES,
  type UiLanguage,
} from '../core/i18n/translator';

/**
 * French or English, chosen in the header — budgetisation's switcher: a trigger, and a menu built
 * from `UI_LANGUAGES`, so a third language is a constant and a JSON file, not a change here.
 *
 * The trigger SHOWS the language in play (its code) rather than only an icon, and its accessible
 * name starts with that same code, so what is seen is what is announced.
 *
 * Each language is named in ITSELF — "Français", never "French": someone who has landed in the
 * wrong language must recognise their own. That is why the endonyms are a constant, not keys, and
 * why each item carries its own `lang`, so a screen reader voices it correctly.
 *
 * The choice is remembered (see `TranslocoTranslator`); icons are inline, as no icon font loads.
 */
@Component({
  selector: 'app-language-switcher',
  imports: [MatButtonModule, MatMenuModule, TranslocoPipe],
  template: `
    <button
      matButton
      type="button"
      class="trigger"
      [matMenuTriggerFor]="menu"
      [attr.aria-label]="
        ('nav.language' | transloco: { code: code(translator.language()) }) +
        '. ' +
        ('nav.chooseLanguage' | transloco)
      "
      [title]="'nav.chooseLanguage' | transloco"
    >
      <span class="item">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="9" />
          <path
            d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"
          />
        </svg>
        <span class="code">{{ code(translator.language()) }}</span>
      </span>
    </button>

    <mat-menu #menu="matMenu" xPosition="before">
      @for (language of languages; track language) {
        <button
          mat-menu-item
          type="button"
          role="menuitemradio"
          [attr.aria-checked]="translator.language() === language"
          [attr.lang]="language"
          (click)="translator.use(language)"
        >
          <span class="item">
            <svg class="check" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              @if (translator.language() === language) {
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              }
            </svg>
            <span class="endonym">{{ endonyms[language] }}</span>
          </span>
        </button>
      }
    </mat-menu>
  `,
  styles: `
    :host {
      display: inline-flex;
    }
    /* On the teal header: the header's own ink, and its white focus ring (set by the shell). */
    .trigger {
      --mat-button-text-label-text-color: var(--muso-chrome-fg);
      --mat-button-text-state-layer-color: var(--muso-chrome-fg);
      font-weight: 600;
    }
    svg {
      inline-size: 1.25rem;
      block-size: 1.25rem;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.6;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    /* On a phone-width header: no minimum width, little padding (see the shell). */
    @media (max-width: 40rem) {
      .trigger {
        --mat-button-text-horizontal-padding: calc(var(--muso-space-unit) / 2);
        min-inline-size: 0;
      }
    }
    .code {
      letter-spacing: 0.02em;
    }
    /* Material wraps a button's content in its own label span, so the spacing lives in here. */
    .item {
      display: inline-flex;
      align-items: center;
      gap: var(--muso-space-2);
    }
    .trigger .item {
      gap: var(--muso-space-1);
    }
    .check {
      color: var(--muso-teal);
      stroke-width: 2.4;
    }
    .endonym {
      font-weight: 500;
    }
  `,
})
export class LanguageSwitcher {
  protected readonly translator = inject(Translator);
  protected readonly languages: readonly UiLanguage[] = UI_LANGUAGES;
  protected readonly endonyms = LANGUAGE_ENDONYMS;

  protected code(language: UiLanguage): string {
    return language.toUpperCase();
  }
}
