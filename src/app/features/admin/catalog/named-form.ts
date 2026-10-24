import { Component, computed, effect, input, output, signal } from '@angular/core';
import { FormField, form, requiredError, validate } from '@angular/forms/signals';
import { TranslocoPipe } from '@jsverse/transloco';
import type { NamedDraft } from '../../../core/admin/catalog-admin-api';
import type { Language } from '../../../core/catalog/catalog.model';

export interface NamedSave {
  readonly draft: NamedDraft;
  /** Only when the form picked one: a new project's. */
  readonly baseLanguageId: string | null;
}

let nextId = 0;

/**
 * A project's, protocol's or theme's name and description, shared by create and edit. Given
 * `languages`, it also asks for a base language — only ever when creating a project.
 */
@Component({
  selector: 'app-named-form',
  imports: [FormField, TranslocoPipe],
  template: `
    <form novalidate [class.create]="mode() === 'create'" (submit)="submit($event)">
      <label [for]="id + '-name'">{{ 'admin.catalog.name' | transloco }}</label>
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
      <label [for]="id + '-description'">{{ 'admin.catalog.description' | transloco }}</label>
      <textarea rows="2" [id]="id + '-description'" [formField]="field.description"></textarea>
      @if (languages(); as choices) {
        <label [for]="id + '-language'">{{ 'browse.baseLanguage' | transloco }}</label>
        <select
          [id]="id + '-language'"
          [formField]="field.baseLanguageId"
          [attr.aria-invalid]="languageMissing() ? 'true' : null"
          [attr.aria-describedby]="
            languageMissing() ? id + '-language-error' : id + '-language-help'
          "
        >
          <option value="">{{ 'admin.catalog.chooseLanguage' | transloco }}</option>
          @for (language of choices; track language.id) {
            <option [value]="language.id">{{ language.name }} ({{ language.code }})</option>
          }
        </select>
        @if (languageMissing()) {
          <p class="field-error" [id]="id + '-language-error'">
            {{ 'admin.catalog.languageRequired' | transloco }}
          </p>
        } @else {
          <p class="muso-meta" [id]="id + '-language-help'">
            {{ 'admin.catalog.baseLanguageFinal' | transloco }}
          </p>
        }
      }
      @if (hint(); as words) {
        <p class="muso-meta">{{ words }}</p>
      }
      @if (error(); as message) {
        <p class="field-error" role="alert">{{ message }}</p>
      }
      <div class="actions">
        <button type="submit" [disabled]="busy()">
          {{ (mode() === 'create' ? submitLabel() : 'authoring.save') | transloco }}
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
    textarea,
    select {
      max-inline-size: 32rem;
    }
  `,
})
export class NamedForm {
  protected readonly id = `named-form-${nextId++}`;

  readonly mode = input<'create' | 'edit'>('create');
  /** A new object resets the form — after a create, or when editing another entry. */
  readonly initial = input<NamedDraft>({ name: '', description: null });
  /** The i18n key of the create button. */
  readonly submitLabel = input('admin.catalog.createSubmit');
  /** The base languages to pick from; null when there is none to pick. */
  readonly languages = input<readonly Language[] | null>(null);
  /** What the form cannot change, already translated. */
  readonly hint = input<string | null>(null);
  readonly busy = input(false);
  /** The engine's refusal, already translated. */
  readonly error = input<string | null>(null);
  readonly save = output<NamedSave>();
  readonly cancel = output();

  readonly #model = signal({ name: '', description: '', baseLanguageId: '' });
  protected readonly field = form(this.#model, (path) => {
    validate(path.name, ({ value }) => (value().trim() === '' ? requiredError() : undefined));
    validate(path.baseLanguageId, ({ value }) =>
      this.languages() !== null && value() === '' ? requiredError() : undefined,
    );
  });
  readonly #tried = signal(false);
  protected readonly nameBlank = computed(() => this.#tried() && this.field.name().invalid());
  protected readonly languageMissing = computed(
    () => this.#tried() && this.field.baseLanguageId().invalid(),
  );

  constructor() {
    effect(() => {
      const { name, description } = this.initial();
      this.#model.set({ name, description: description ?? '', baseLanguageId: '' });
      this.#tried.set(false);
    });
  }

  protected submit(event: Event): void {
    event.preventDefault();
    this.#tried.set(true);
    if (this.field().invalid()) return;
    const { name, description, baseLanguageId } = this.#model();
    this.save.emit({
      draft: { name: name.trim(), description: description.trim() || null },
      baseLanguageId: this.languages() === null ? null : baseLanguageId,
    });
  }
}
