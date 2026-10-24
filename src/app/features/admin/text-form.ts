import { Component, computed, effect, input, output, signal } from '@angular/core';
import { FormField, form, requiredError, validate } from '@angular/forms/signals';
import { TranslocoPipe } from '@jsverse/transloco';

/** A new object resets the form, even to the same text. */
export interface TextSeed {
  readonly text: string;
}

let nextId = 0;

/** One required line of text: a new intent or category, a language's new name. */
@Component({
  selector: 'app-text-form',
  imports: [FormField, TranslocoPipe],
  template: `
    <form novalidate [class.create]="mode() === 'create'" (submit)="submit($event)">
      <label [for]="id">{{ label() | transloco }}</label>
      <input
        type="text"
        autocomplete="off"
        [id]="id"
        [formField]="field.text"
        [attr.aria-invalid]="blank() ? 'true' : null"
        [attr.aria-describedby]="blank() ? id + '-blank' : null"
      />
      @if (blank()) {
        <p class="field-error" [id]="id + '-blank'">{{ 'admin.required' | transloco }}</p>
      }
      @if (hint(); as words) {
        <p class="muso-meta">{{ words }}</p>
      }
      @if (error(); as message) {
        <p class="field-error" role="alert">{{ message }}</p>
      }
      <div class="actions">
        <button type="submit" [disabled]="busy()">{{ submitLabel() | transloco }}</button>
        @if (mode() === 'edit') {
          <button type="button" class="secondary" (click)="cancel.emit()">
            {{ 'authoring.cancel' | transloco }}
          </button>
        }
      </div>
    </form>
  `,
  styles: `
    input {
      max-inline-size: 32rem;
    }
  `,
})
export class TextForm {
  protected readonly id = `text-form-${nextId++}`;

  readonly mode = input<'create' | 'edit'>('create');
  /** The i18n keys of the field and of its button. */
  readonly label = input.required<string>();
  readonly submitLabel = input('authoring.save');
  readonly initial = input<TextSeed>({ text: '' });
  /** What the form cannot change, already translated. */
  readonly hint = input<string | null>(null);
  readonly busy = input(false);
  /** The engine's refusal, already translated. */
  readonly error = input<string | null>(null);
  readonly save = output<string>();
  readonly cancel = output();

  readonly #model = signal({ text: '' });
  protected readonly field = form(this.#model, (path) => {
    validate(path.text, ({ value }) => (value().trim() === '' ? requiredError() : undefined));
  });
  readonly #tried = signal(false);
  protected readonly blank = computed(() => this.#tried() && this.field.text().invalid());

  constructor() {
    effect(() => {
      this.#model.set({ text: this.initial().text });
      this.#tried.set(false);
    });
  }

  protected submit(event: Event): void {
    event.preventDefault();
    this.#tried.set(true);
    if (this.field().invalid()) return;
    this.save.emit(this.#model().text.trim());
  }
}
