import { Component, computed, effect, input, output, signal } from '@angular/core';
import { FormField, form, requiredError, validate } from '@angular/forms/signals';
import { TranslocoPipe } from '@jsverse/transloco';
import type { VoiceDraft } from '../../../core/audio/voices-api';

let nextId = 0;

/** A voice's name and optional note, shared by create and edit. A blank note is none. */
@Component({
  selector: 'app-voice-form',
  imports: [FormField, TranslocoPipe],
  template: `
    <form novalidate [class.create]="mode() === 'create'" (submit)="submit($event)">
      <label [for]="id + '-name'">{{ 'admin.voices.name' | transloco }}</label>
      <input
        type="text"
        autocomplete="off"
        [id]="id + '-name'"
        [formField]="field.name"
        [attr.aria-invalid]="nameBlank() ? 'true' : null"
        [attr.aria-describedby]="nameBlank() ? id + '-name-error' : null"
      />
      @if (nameBlank()) {
        <p class="field-error" [id]="id + '-name-error'">{{ 'admin.required' | transloco }}</p>
      }
      <label [for]="id + '-note'">{{ 'admin.voices.note' | transloco }}</label>
      <textarea rows="2" [id]="id + '-note'" [formField]="field.note"></textarea>
      @if (error(); as message) {
        <p class="field-error" role="alert">{{ message }}</p>
      }
      <div class="actions">
        <button type="submit" [disabled]="busy()">
          {{ (mode() === 'create' ? 'admin.voices.createSubmit' : 'authoring.save') | transloco }}
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
export class VoiceForm {
  protected readonly id = `voice-form-${nextId++}`;

  readonly mode = input<'create' | 'edit'>('create');
  /** A new object resets the form, even to the same values. */
  readonly initial = input<VoiceDraft>({ name: '', note: null });
  readonly busy = input(false);
  /** The engine's refusal, already translated. */
  readonly error = input<string | null>(null);
  readonly save = output<VoiceDraft>();
  readonly cancel = output();

  readonly #model = signal({ name: '', note: '' });
  protected readonly field = form(this.#model, (path) => {
    validate(path.name, ({ value }) => (value().trim() === '' ? requiredError() : undefined));
  });
  readonly #tried = signal(false);
  protected readonly nameBlank = computed(() => this.#tried() && this.field.name().invalid());

  constructor() {
    effect(() => {
      const { name, note } = this.initial();
      this.#model.set({ name, note: note ?? '' });
      this.#tried.set(false);
    });
  }

  protected submit(event: Event): void {
    event.preventDefault();
    this.#tried.set(true);
    if (this.field().invalid()) return;
    const { name, note } = this.#model();
    this.save.emit({ name: name.trim(), note: note.trim() === '' ? null : note.trim() });
  }
}
