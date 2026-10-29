import { Component, computed, effect, input, output, signal } from '@angular/core';
import { FormField, form, requiredError, validate } from '@angular/forms/signals';
import { TranslocoPipe } from '@jsverse/transloco';
import type { GlossaryFormDraft } from '../../../core/admin/glossary-admin-api';
import type { Language } from '../../../core/catalog/catalog.model';

export interface GlossaryFormSave {
  readonly languageId: string;
  readonly draft: GlossaryFormDraft;
}

const EMPTY: GlossaryFormDraft = { preferred: '', synonyms: [], avoid: [], note: null };

/** One entry a line: each trimmed, the blank lines dropped. */
const linesOf = (text: string): string[] =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '');

let nextId = 0;

/**
 * A term's form in one language. Adding, it asks which of the `languages` the term lacks;
 * replacing, the language is `fixed`.
 */
@Component({
  selector: 'app-glossary-form-editor',
  imports: [FormField, TranslocoPipe],
  template: `
    <form novalidate class="glossary-form-editor" (submit)="submit($event)">
      @if (fixed(); as language) {
        <p class="muso-meta">
          {{ 'admin.glossary.forms.language' | transloco }} : {{ language.name }} ({{
            language.code
          }})
        </p>
      } @else {
        <label [for]="id + '-language'">{{ 'admin.glossary.forms.language' | transloco }}</label>
        <select
          [id]="id + '-language'"
          [formField]="field.languageId"
          [attr.aria-invalid]="languageMissing() ? 'true' : null"
          [attr.aria-describedby]="languageMissing() ? id + '-language-error' : null"
        >
          <option value="">{{ 'admin.catalog.chooseLanguage' | transloco }}</option>
          @for (language of languages(); track language.id) {
            <option [value]="language.id">{{ language.name }} ({{ language.code }})</option>
          }
        </select>
        @if (languageMissing()) {
          <p class="field-error" [id]="id + '-language-error'">
            {{ 'admin.glossary.forms.languageRequired' | transloco }}
          </p>
        }
      }

      <label [for]="id + '-preferred'">{{ 'admin.glossary.forms.preferred' | transloco }}</label>
      <input
        type="text"
        autocomplete="off"
        [id]="id + '-preferred'"
        [formField]="field.preferred"
        [attr.aria-invalid]="preferredBlank() ? 'true' : null"
        [attr.aria-describedby]="preferredBlank() ? id + '-preferred-error' : null"
      />
      @if (preferredBlank()) {
        <p class="field-error" [id]="id + '-preferred-error'">
          {{ 'admin.required' | transloco }}
        </p>
      }

      <label [for]="id + '-synonyms'">{{ 'admin.glossary.forms.synonyms' | transloco }}</label>
      <textarea
        rows="3"
        [id]="id + '-synonyms'"
        [formField]="field.synonyms"
        [attr.aria-describedby]="id + '-synonyms-hint'"
      ></textarea>
      <p class="muso-meta hint" [id]="id + '-synonyms-hint'">
        {{ 'admin.glossary.forms.synonymsHint' | transloco }}
      </p>

      <label [for]="id + '-avoid'">{{ 'admin.glossary.forms.avoid' | transloco }}</label>
      <textarea
        rows="2"
        [id]="id + '-avoid'"
        [formField]="field.avoid"
        [attr.aria-describedby]="id + '-avoid-hint'"
      ></textarea>
      <p class="muso-meta hint" [id]="id + '-avoid-hint'">
        {{ 'admin.glossary.forms.avoidHint' | transloco }}
      </p>

      <label [for]="id + '-note'">{{ 'admin.glossary.note' | transloco }}</label>
      <textarea rows="2" [id]="id + '-note'" [formField]="field.note"></textarea>

      @if (error(); as message) {
        <p class="field-error" role="alert">{{ message }}</p>
      }
      <div class="actions">
        <button type="submit" [disabled]="busy()">{{ 'authoring.save' | transloco }}</button>
        <button type="button" class="secondary" (click)="cancel.emit()">
          {{ 'authoring.cancel' | transloco }}
        </button>
      </div>
    </form>
  `,
  styles: `
    input,
    textarea,
    select {
      max-inline-size: 32rem;
    }
    .hint {
      margin-block: 0;
    }
  `,
})
export class GlossaryFormEditor {
  protected readonly id = `glossary-form-${nextId++}`;

  /** The languages a new form may take; unused when the language is fixed. */
  readonly languages = input<readonly Language[]>([]);
  /** The language of the form being replaced; null when adding. */
  readonly fixed = input<Language | null>(null);
  readonly initial = input<GlossaryFormDraft>(EMPTY);
  readonly busy = input(false);
  /** The engine's refusal, already translated. */
  readonly error = input<string | null>(null);
  readonly save = output<GlossaryFormSave>();
  readonly cancel = output();

  readonly #model = signal({ languageId: '', preferred: '', synonyms: '', avoid: '', note: '' });
  protected readonly field = form(this.#model, (path) => {
    validate(path.languageId, ({ value }) =>
      this.fixed() === null && value() === '' ? requiredError() : undefined,
    );
    validate(path.preferred, ({ value }) => (value().trim() === '' ? requiredError() : undefined));
  });
  readonly #tried = signal(false);
  protected readonly languageMissing = computed(
    () => this.#tried() && this.field.languageId().invalid(),
  );
  protected readonly preferredBlank = computed(
    () => this.#tried() && this.field.preferred().invalid(),
  );

  constructor() {
    effect(() => {
      const { preferred, synonyms, avoid, note } = this.initial();
      this.#model.set({
        languageId: '',
        preferred,
        synonyms: synonyms.join('\n'),
        avoid: avoid.join('\n'),
        note: note ?? '',
      });
      this.#tried.set(false);
    });
  }

  protected submit(event: Event): void {
    event.preventDefault();
    this.#tried.set(true);
    if (this.field().invalid()) return;
    const { languageId, preferred, synonyms, avoid, note } = this.#model();
    this.save.emit({
      languageId: this.fixed()?.id ?? languageId,
      draft: {
        preferred: preferred.trim(),
        synonyms: linesOf(synonyms),
        avoid: linesOf(avoid),
        note: note.trim() || null,
      },
    });
  }
}
