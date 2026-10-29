import { Component, effect, input, output, signal, untracked } from '@angular/core';
import { FormField, form, requiredError, validate } from '@angular/forms/signals';
import { TranslocoPipe } from '@jsverse/transloco';
import type { Language } from '../../core/catalog/catalog.model';
import {
  TRANSLATION_ENGINES,
  type TranslationEngine,
} from '../../core/catalog/concept-authoring-api';

export interface TranslationRequest {
  readonly targetLanguageId: string;
  readonly engine: TranslationEngine;
}

const ENGINE_KEYS = {
  llm: 'authoring.translate.engines.llm',
  google: 'authoring.translate.engines.google',
} as const;

let nextId = 0;

/**
 * Into which language, by which engine. The translation lands in that language's QASet. Offered a
 * single language, it is already chosen.
 */
@Component({
  selector: 'app-translate-form',
  imports: [FormField, TranslocoPipe],
  template: `
    <form novalidate (submit)="submit($event)">
      <label [for]="id + '-target'">{{ 'authoring.translate.target' | transloco }}</label>
      <select
        [id]="id + '-target'"
        [formField]="field.targetLanguageId"
        [attr.aria-invalid]="tried() && field.targetLanguageId().invalid() ? 'true' : null"
      >
        <option value="">{{ 'authoring.chooseLanguage' | transloco }}</option>
        @for (language of languages(); track language.id) {
          <option [value]="language.id">{{ language.name }}</option>
        }
      </select>
      @if (tried() && field.targetLanguageId().invalid()) {
        <p class="field-error">{{ 'authoring.languageRequired' | transloco }}</p>
      }
      <fieldset>
        <legend>{{ 'authoring.translate.engine' | transloco }}</legend>
        @for (engine of engines; track engine) {
          <label class="choice">
            <input type="radio" [value]="engine" [formField]="field.engine" />
            {{ engineKeys[engine] | transloco }}
          </label>
        }
      </fieldset>
      @if (error(); as message) {
        <p class="field-error" role="alert">{{ message }}</p>
      }
      <div class="actions">
        <button type="submit" [disabled]="busy()">
          {{ 'authoring.translate.submit' | transloco }}
        </button>
        <button type="button" class="secondary" (click)="cancel.emit()">
          {{ 'authoring.cancel' | transloco }}
        </button>
      </div>
    </form>
  `,
  styles: `
    fieldset {
      display: flex;
      flex-wrap: wrap;
      gap: var(--muso-space-1) var(--muso-space-3);
      margin: 0;
      padding: var(--muso-space-1) var(--muso-space-2);
    }
    .choice {
      display: inline-flex;
      align-items: center;
      gap: var(--muso-space-1);
      font-weight: 400;
    }
  `,
})
export class TranslateForm {
  protected readonly id = `translate-${nextId++}`;
  protected readonly engines = TRANSLATION_ENGINES;
  protected readonly engineKeys = ENGINE_KEYS;

  readonly languages = input.required<readonly Language[]>();
  readonly busy = input(false);
  readonly error = input<string | null>(null);
  readonly submitted = output<TranslationRequest>();
  readonly cancel = output();

  readonly #model = signal<{ targetLanguageId: string; engine: TranslationEngine }>({
    targetLanguageId: '',
    engine: 'llm',
  });
  protected readonly field = form(this.#model, (path) => {
    validate(path.targetLanguageId, ({ value }) => (value() === '' ? requiredError() : undefined));
  });
  protected readonly tried = signal(false);

  constructor() {
    effect(() => {
      const offered = this.languages();
      if (offered.length !== 1 || untracked(this.#model).targetLanguageId !== '') return;
      this.#model.update((model) => ({ ...model, targetLanguageId: offered[0].id }));
    });
  }

  protected submit(event: Event): void {
    event.preventDefault();
    this.tried.set(true);
    if (this.field().invalid()) return;
    this.submitted.emit(this.#model());
  }
}
