import { Component, computed, effect, input, output, signal } from '@angular/core';
import { FormField, form, requiredError, validate } from '@angular/forms/signals';
import { TranslocoPipe } from '@jsverse/transloco';

let nextId = 0;

/** A labelled text area that saves its trimmed value — non-blank unless optional. */
@Component({
  selector: 'app-text-editor',
  imports: [FormField, TranslocoPipe],
  template: `
    <form novalidate (submit)="submit($event)">
      <label [for]="fieldId">{{ label() }}</label>
      <textarea
        [id]="fieldId"
        [rows]="rows()"
        [formField]="field.text"
        [attr.lang]="lang()"
        [attr.aria-invalid]="blank() ? 'true' : null"
        [attr.aria-describedby]="blank() ? fieldId + '-blank' : null"
      ></textarea>
      @if (blank()) {
        <p class="field-error" [id]="fieldId + '-blank'">{{ 'authoring.blank' | transloco }}</p>
      }
      @if (error(); as message) {
        <p class="field-error" role="alert">{{ message }}</p>
      }
      <div class="actions">
        <button type="submit" [disabled]="busy()">
          {{ saveLabel() ?? ('authoring.save' | transloco) }}
        </button>
        <button type="button" class="secondary" (click)="cancel.emit()">
          {{ 'authoring.cancel' | transloco }}
        </button>
      </div>
    </form>
  `,
})
export class TextEditor {
  protected readonly fieldId = `text-editor-${nextId++}`;

  readonly label = input.required<string>();
  readonly initial = input('');
  readonly rows = input(3);
  readonly required = input(true);
  /** The content's language, so assistive technology reads the draft in it. */
  readonly lang = input<string>();
  readonly saveLabel = input<string>();
  readonly busy = input(false);
  /** The engine's refusal, already translated. */
  readonly error = input<string | null>(null);
  readonly save = output<string>();
  readonly cancel = output();

  readonly #model = signal({ text: '' });
  protected readonly field = form(this.#model, (path) => {
    validate(path.text, ({ value }) =>
      this.required() && value().trim() === '' ? requiredError() : undefined,
    );
  });
  readonly #submitted = signal(false);
  protected readonly blank = computed(() => this.#submitted() && this.field.text().invalid());

  constructor() {
    effect(() => this.#model.set({ text: this.initial() }));
  }

  protected submit(event: Event): void {
    event.preventDefault();
    this.#submitted.set(true);
    if (this.field.text().invalid()) return;
    this.save.emit(this.#model().text.trim());
  }
}
