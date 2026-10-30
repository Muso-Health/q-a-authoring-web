import { Component, computed, inject, input, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { Language } from '../../core/catalog/catalog.model';
import { FocusReturn, FocusReturnTarget } from '../../shared/ui/focus-return';
import { Icon } from '../../shared/ui/icon';
import { ModalDialog } from '../../shared/ui/modal-dialog';
import { ConceptEditor } from './concept-editor';
import { TranslateForm, type TranslationRequest } from './translate-form';

/**
 * A language the notion has no question in yet: a soft chip that says so — intentional, not an
 * error — and, for an author, « Traduire », which translates the whole notion into it from a modal.
 */
@Component({
  selector: 'app-untranslated',
  imports: [TranslocoPipe, FocusReturnTarget, Icon, ModalDialog, TranslateForm],
  template: `
    @let l = language();
    <span class="untranslated">{{ 'concept.untranslated' | transloco }}</span>
    @if (translatable()) {
      <button
        type="button"
        class="secondary small"
        [appFocusReturn]="key()"
        [attr.aria-label]="'authoring.translateInto' | transloco: { language: l.name }"
        [disabled]="editor.busy()"
        (click)="open.set(true)"
      >
        <app-icon name="translate" />
        {{ 'authoring.translate.submit' | transloco }}
      </button>
    }

    @if (open()) {
      <app-dialog
        [title]="'authoring.translateInto' | transloco: { language: l.name }"
        [locked]="editor.busy()"
        (dismissed)="close()"
      >
        <p class="muso-meta">{{ 'authoring.translateConcept.lead' | transloco }}</p>
        <app-translate-form
          [languages]="[l]"
          [busy]="editor.busy()"
          [error]="editor.errorFor('translate-concept')"
          (submitted)="translate($event)"
          (cancel)="close()"
        />
      </app-dialog>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--muso-space-2);
    }
    /* A soft chip in the brand's light yellow. */
    .untranslated {
      display: inline-flex;
      align-items: center;
      padding: 0.15rem var(--muso-space-2);
      border: 1px dashed var(--muso-border-strong);
      border-radius: 999px;
      background: var(--muso-yellow-12);
      color: var(--muso-text);
      font-size: var(--muso-caption-size);
      font-style: italic;
    }
    button {
      display: inline-flex;
      align-items: center;
      gap: var(--muso-space-1);
    }
  `,
})
export class Untranslated {
  protected readonly editor = inject(ConceptEditor);
  readonly #focus = inject(FocusReturn);

  readonly language = input.required<Language>();
  /** Where it shows — the principal pair or a tab — so each keeps its own focus target. */
  readonly place = input.required<'pair' | 'tab'>();

  protected readonly open = signal(false);

  /** Only into a project language other than the base, and from a base QASet. */
  protected readonly translatable = computed(
    () =>
      this.editor.canAuthor() &&
      this.editor.hasBase() &&
      this.editor.conceptTargets().some((l) => l.id === this.language().id),
  );

  protected readonly key = computed(() => `translate-into:${this.place()}:${this.language().id}`);

  protected async translate({ engine }: TranslationRequest): Promise<void> {
    if (await this.editor.translateConcept(this.language().id, engine)) this.close();
  }

  protected close(): void {
    this.open.set(false);
    this.editor.clearError('translate-concept');
    this.#focus.to(this.key());
  }
}
