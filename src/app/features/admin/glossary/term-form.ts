import { Component, computed, effect, input, output, signal } from '@angular/core';
import { FormField, form, requiredError, validate } from '@angular/forms/signals';
import { TranslocoPipe } from '@jsverse/transloco';
import type { GlossaryTermDraft } from '../../../core/admin/glossary-admin-api';

let nextId = 0;

/** A glossary term's label and note, shared by create and edit. */
@Component({
  selector: 'app-term-form',
  imports: [FormField, TranslocoPipe],
  template: `
    <form
      novalidate
      [class.create]="mode() === 'create'"
      [class.term-edit]="mode() === 'edit'"
      (submit)="submit($event)"
    >
      <label [for]="id + '-label'">{{ 'admin.glossary.label' | transloco }}</label>
      <input
        type="text"
        autocomplete="off"
        [id]="id + '-label'"
        [formField]="field.label"
        [attr.aria-invalid]="labelBlank() ? 'true' : null"
        [attr.aria-describedby]="labelBlank() ? id + '-label-error' : null"
      />
      @if (labelBlank()) {
        <p class="field-error" [id]="id + '-label-error'">{{ 'admin.required' | transloco }}</p>
      }
      <label [for]="id + '-note'">{{ 'admin.glossary.note' | transloco }}</label>
      <textarea rows="2" [id]="id + '-note'" [formField]="field.note"></textarea>
      @if (error(); as message) {
        <p class="field-error" role="alert">{{ message }}</p>
      }
      <div class="actions">
        <button type="submit" [disabled]="busy()">
          {{ (mode() === 'create' ? 'admin.glossary.createSubmit' : 'authoring.save') | transloco }}
        </button>
        @if (mode() === 'edit') {
          <button type="button" class="secondary" (click)="cancel.emit()">
            {{ 'authoring.cancel' | transloco }}
          </button>
        }
      </div>
    </form>
  `,
  styles: `
    input,
    textarea {
      max-inline-size: 32rem;
    }
  `,
})
export class TermForm {
  protected readonly id = `term-form-${nextId++}`;

  readonly mode = input<'create' | 'edit'>('create');
  /** A new object resets the form — after a create, or when editing another term. */
  readonly initial = input<GlossaryTermDraft>({ label: '', note: null });
  readonly busy = input(false);
  /** The engine's refusal, already translated. */
  readonly error = input<string | null>(null);
  readonly save = output<GlossaryTermDraft>();
  readonly cancel = output();

  readonly #model = signal({ label: '', note: '' });
  protected readonly field = form(this.#model, (path) => {
    validate(path.label, ({ value }) => (value().trim() === '' ? requiredError() : undefined));
  });
  readonly #tried = signal(false);
  protected readonly labelBlank = computed(() => this.#tried() && this.field.label().invalid());

  constructor() {
    effect(() => {
      const { label, note } = this.initial();
      this.#model.set({ label, note: note ?? '' });
      this.#tried.set(false);
    });
  }

  protected submit(event: Event): void {
    event.preventDefault();
    this.#tried.set(true);
    if (this.field().invalid()) return;
    const { label, note } = this.#model();
    this.save.emit({ label: label.trim(), note: note.trim() || null });
  }
}
