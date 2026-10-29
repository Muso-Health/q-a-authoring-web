import { Component, computed, effect, input, output, signal } from '@angular/core';
import { FormField, form, requiredError, validate } from '@angular/forms/signals';
import { TranslocoPipe } from '@jsverse/transloco';
import type { Language } from '../../core/catalog/catalog.model';

export interface LanguageAnswer {
  readonly languageId: string;
  readonly answerText: string;
}

let nextId = 0;

/** Choose a language and give its answer — how a concept's QASet in that language begins. */
@Component({
  selector: 'app-language-answer-form',
  imports: [FormField, TranslocoPipe],
  template: `
    <form novalidate (submit)="submit($event)">
      <label [for]="id + '-language'">{{ 'authoring.language' | transloco }}</label>
      <select
        [id]="id + '-language'"
        [formField]="field.languageId"
        [attr.aria-invalid]="showErrors() && field.languageId().invalid() ? 'true' : null"
      >
        <option value="">{{ 'authoring.chooseLanguage' | transloco }}</option>
        @for (language of languages(); track language.id) {
          <option [value]="language.id">{{ language.name }}</option>
        }
      </select>
      @if (showErrors() && field.languageId().invalid()) {
        <p class="field-error">{{ 'authoring.languageRequired' | transloco }}</p>
      }
      <label [for]="id + '-answer'">{{ 'authoring.answerText' | transloco }}</label>
      <textarea
        [id]="id + '-answer'"
        rows="3"
        [formField]="field.answerText"
        [attr.aria-invalid]="showErrors() && field.answerText().invalid() ? 'true' : null"
      ></textarea>
      @if (showErrors() && field.answerText().invalid()) {
        <p class="field-error">{{ 'authoring.blank' | transloco }}</p>
      }
      @if (error(); as message) {
        <p class="field-error" role="alert">{{ message }}</p>
      }
      <div class="actions">
        <button type="submit" [disabled]="busy()">{{ submitLabel() }}</button>
        <button type="button" class="secondary" (click)="cancel.emit()">
          {{ 'authoring.cancel' | transloco }}
        </button>
      </div>
    </form>
  `,
})
export class LanguageAnswerForm {
  protected readonly id = `language-answer-${nextId++}`;

  readonly languages = input.required<readonly Language[]>();
  /** Pre-selected, e.g. the project's base language. */
  readonly preselected = input<string>('');
  readonly submitLabel = input.required<string>();
  readonly busy = input(false);
  readonly error = input<string | null>(null);
  readonly submitted = output<LanguageAnswer>();
  readonly cancel = output();

  readonly #model = signal({ languageId: '', answerText: '' });
  protected readonly field = form(this.#model, (path) => {
    validate(path.languageId, ({ value }) => (value() === '' ? requiredError() : undefined));
    validate(path.answerText, ({ value }) => (value().trim() === '' ? requiredError() : undefined));
  });
  readonly #tried = signal(false);
  protected readonly showErrors = computed(() => this.#tried());

  constructor() {
    effect(() => {
      const languageId = this.preselected();
      this.#model.update((model) => ({ ...model, languageId }));
    });
  }

  protected submit(event: Event): void {
    event.preventDefault();
    this.#tried.set(true);
    if (this.field().invalid()) return;
    const { languageId, answerText } = this.#model();
    this.submitted.emit({ languageId, answerText: answerText.trim() });
  }
}
