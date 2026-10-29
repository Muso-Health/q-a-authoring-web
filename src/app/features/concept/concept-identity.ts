import { Component, computed, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { Language } from '../../core/catalog/catalog.model';
import { FocusReturn, FocusReturnTarget } from '../../shared/ui/focus-return';
import { Icon } from '../../shared/ui/icon';
import { ModalDialog } from '../../shared/ui/modal-dialog';
import { ConceptEditor } from './concept-editor';
import type { ItemView } from './concept-view';
import { TranslateForm, type TranslationRequest } from './translate-form';
import { VariantItem } from './variant-item';

/** One other project language, and its main question if it has one yet. */
interface TranslationRow {
  readonly language: Language;
  readonly qasetId: string | null;
  readonly main: ItemView | null;
}

/**
 * What names the notion: its base-language pair — the main question, then its answer — and under
 * it, every other project language's main question, each with its tools; a language without one
 * yet offers to translate the notion into it.
 */
@Component({
  selector: 'app-concept-identity',
  imports: [TranslocoPipe, FocusReturnTarget, Icon, ModalDialog, TranslateForm, VariantItem],
  template: `
    @let base = baseSection();
    <h1 class="base-question" [attr.lang]="base?.language?.code ?? null">
      {{ editor.view()?.title ?? ('concept.untitled' | transloco) }}
    </h1>
    @if (base) {
      <p class="base-answer" [attr.lang]="base.language.code">{{ base.answer.text }}</p>
    }

    @if (rows().length > 0) {
      <ul class="translations" [attr.aria-label]="'concept.translations' | transloco">
        @for (row of rows(); track row.language.id) {
          <li [attr.data-lang]="row.language.code">
            <span class="language">{{ row.language.name }}</span>
            @if (row.main && row.qasetId) {
              <app-variant-item
                context="header"
                [qasetId]="row.qasetId"
                [language]="row.language"
                [variant]="row.main"
                [number]="1"
              />
            } @else {
              <span class="pending">
                <span class="untranslated">{{ 'concept.untranslated' | transloco }}</span>
                @if (editor.canAuthor() && editor.hasBase()) {
                  <button
                    type="button"
                    class="secondary small"
                    [appFocusReturn]="'translate-into:' + row.language.id"
                    [attr.aria-label]="
                      'authoring.translateInto' | transloco: { language: row.language.name }
                    "
                    [disabled]="editor.busy()"
                    (click)="into.set(row.language)"
                  >
                    <app-icon name="translate" />
                    {{ 'authoring.translate.submit' | transloco }}
                  </button>
                }
              </span>
            }
          </li>
        }
      </ul>
    }

    @if (into(); as language) {
      <app-dialog
        [title]="'authoring.translateInto' | transloco: { language: language.name }"
        [locked]="editor.busy()"
        (dismissed)="close(language)"
      >
        <p class="muso-meta">{{ 'authoring.translateConcept.lead' | transloco }}</p>
        <app-translate-form
          [languages]="[language]"
          [busy]="editor.busy()"
          [error]="editor.errorFor('translate-concept')"
          (submitted)="translate(language, $event)"
          (cancel)="close(language)"
        />
      </app-dialog>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .base-question {
      margin: 0;
      font-size: var(--muso-body-lg-size);
      line-height: 1.35;
      overflow-wrap: anywhere;
    }
    .base-answer {
      margin: var(--muso-space-1) 0 0;
      color: var(--muso-text-muted);
      overflow-wrap: anywhere;
    }
    .translations {
      display: grid;
      gap: var(--muso-space-1);
      margin: var(--muso-space-3) 0 var(--muso-space-2);
      padding: 0;
      list-style: none;
    }
    .translations > li {
      display: grid;
      grid-template-columns: minmax(5.5rem, auto) minmax(0, 1fr);
      align-items: start;
      gap: var(--muso-space-1) var(--muso-space-2);
      padding: var(--muso-space-2);
      border-radius: var(--muso-radius);
      background: var(--surface-alt);
      font-size: 0.9375rem;
    }
    .language {
      font-size: var(--muso-caption-size);
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--muted-fg);
      padding-block-start: 0.15rem;
    }
    .pending {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--muso-space-2);
    }
    /* Intentional, not an error: a soft chip in the brand's light yellow. */
    .untranslated {
      display: inline-flex;
      align-items: center;
      gap: var(--muso-space-1);
      padding: 0.15rem var(--muso-space-2);
      border: 1px dashed var(--muso-border-strong);
      border-radius: 999px;
      background: var(--muso-yellow-12);
      color: var(--muso-text);
      font-size: var(--muso-caption-size);
      font-style: italic;
    }
    .pending button {
      display: inline-flex;
      align-items: center;
      gap: var(--muso-space-1);
    }
    @media (max-width: 30rem) {
      .translations > li {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class ConceptIdentity {
  protected readonly editor = inject(ConceptEditor);
  readonly #focus = inject(FocusReturn);

  protected readonly baseSection = computed(
    () => this.editor.view()?.sections.find((section) => section.isBase) ?? null,
  );

  /** Every project language but the base one, in the project's order. */
  protected readonly rows = computed<readonly TranslationRow[]>(() => {
    const sections = this.editor.view()?.sections ?? [];
    return this.editor.conceptTargets().map((language) => {
      const section = sections.find((s) => s.language.id === language.id);
      return { language, qasetId: section?.id ?? null, main: section?.variants[0] ?? null };
    });
  });

  /** The language being translated into, from its placeholder. */
  protected readonly into = signal<Language | null>(null);

  protected async translate(language: Language, { engine }: TranslationRequest): Promise<void> {
    if (await this.editor.translateConcept(language.id, engine)) this.close(language);
  }

  protected close(language: Language): void {
    this.into.set(null);
    this.editor.clearError('translate-concept');
    this.#focus.to(`translate-into:${language.id}`);
  }
}
