import { Component, computed, inject, input, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { Language } from '../../core/catalog/catalog.model';
import { FocusReturn, FocusReturnTarget } from '../../shared/ui/focus-return';
import { Icon } from '../../shared/ui/icon';
import { LanguageAnswerForm, type LanguageAnswer } from '../../shared/ui/language-answer-form';
import { ModalDialog } from '../../shared/ui/modal-dialog';
import { ConceptEditor } from './concept-editor';
import { TranslateForm, type TranslationRequest } from './translate-form';

/**
 * A language the notion has no question in yet: a soft chip that says so — intentional, not an
 * error — and, for an author, both ways to begin it, each from a modal: « Traduire », the machine
 * translating the whole notion into it, or « Saisir la réponse », writing its answer by hand.
 */
@Component({
  selector: 'app-untranslated',
  imports: [TranslocoPipe, FocusReturnTarget, Icon, LanguageAnswerForm, ModalDialog, TranslateForm],
  template: `
    @let l = language();
    <span class="untranslated">{{ 'concept.untranslated' | transloco }}</span>
    @if (translatable()) {
      <button
        type="button"
        class="secondary small"
        [appFocusReturn]="key('translate-into')"
        [attr.aria-label]="'authoring.translateInto' | transloco: { language: l.name }"
        [disabled]="editor.busy()"
        (click)="dialog.set('translate')"
      >
        <app-icon name="translate" />
        {{ 'authoring.translate.submit' | transloco }}
      </button>
    }
    @if (writable()) {
      <button
        type="button"
        class="secondary small"
        [appFocusReturn]="key('write-answer')"
        [attr.aria-label]="'authoring.writeAnswer.name' | transloco: { language: l.name }"
        [disabled]="editor.busy()"
        (click)="dialog.set('write')"
      >
        <app-icon name="edit" />
        {{ 'authoring.writeAnswer.open' | transloco }}
      </button>
    }

    @switch (dialog()) {
      @case ('translate') {
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
      @case ('write') {
        <app-dialog
          [title]="'authoring.writeAnswer.name' | transloco: { language: l.name }"
          [locked]="editor.busy()"
          (dismissed)="close()"
        >
          <app-language-answer-form
            [languages]="[l]"
            [preselected]="l.id"
            [submitLabel]="'authoring.writeAnswer.submit' | transloco"
            [busy]="editor.busy()"
            [error]="editor.errorFor('add-language')"
            (submitted)="write($event)"
            (cancel)="close()"
          />
        </app-dialog>
      }
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

  protected readonly dialog = signal<'translate' | 'write' | null>(null);

  /** Only into a project language other than the base, and from a base QASet. */
  protected readonly translatable = computed(
    () =>
      this.editor.canAuthor() &&
      this.editor.hasBase() &&
      this.editor.conceptTargets().some((l) => l.id === this.language().id),
  );

  /** By hand, only where the notion has no QASet in that language at all. */
  protected readonly writable = computed(
    () =>
      this.editor.canAuthor() &&
      this.editor.missingLanguages().some((l) => l.id === this.language().id),
  );

  protected key(action: 'translate-into' | 'write-answer'): string {
    return `${action}:${this.place()}:${this.language().id}`;
  }

  protected async translate({ engine }: TranslationRequest): Promise<void> {
    if (await this.editor.translateConcept(this.language().id, engine)) this.close();
  }

  protected async write({ answerText }: LanguageAnswer): Promise<void> {
    if (await this.editor.addLanguage(this.language().id, answerText)) this.close();
  }

  protected close(): void {
    const open = this.dialog();
    this.dialog.set(null);
    if (open === 'write') {
      this.editor.clearError('add-language');
      this.#focus.to(this.key('write-answer'));
    } else {
      this.editor.clearError('translate-concept');
      this.#focus.to(this.key('translate-into'));
    }
  }
}
