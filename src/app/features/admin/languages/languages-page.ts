import { Component, computed, inject, resource, signal } from '@angular/core';
import { FormField, form, requiredError, validate } from '@angular/forms/signals';
import { TranslocoPipe } from '@jsverse/transloco';
import { TaxonomyAdminApi } from '../../../core/admin/taxonomy-admin-api';
import { ConfirmAction } from '../../../shared/ui/confirm-action';
import { FocusReturn, FocusReturnTarget } from '../../../shared/ui/focus-return';
import { LoadError, Loading } from '../../../shared/ui/load-state';
import { AdminWrites, reread } from '../admin-writes';
import { TextForm } from '../text-form';

const CREATE = 'create';
const languageTarget = (id: string) => `language:${id}`;

const blankIsRequired = ({ value }: { value: () => string }) =>
  value().trim() === '' ? requiredError() : undefined;

/** The languages content may be written in: registered by code, renamed, removed while unused. */
@Component({
  selector: 'app-languages-page',
  imports: [
    FormField,
    TranslocoPipe,
    Loading,
    LoadError,
    TextForm,
    ConfirmAction,
    FocusReturnTarget,
  ],
  providers: [AdminWrites],
  template: `
    <h2>{{ 'admin.languages.title' | transloco }}</h2>

    <section class="muso-card" aria-labelledby="create-language-heading">
      <h3 id="create-language-heading">{{ 'admin.languages.create' | transloco }}</h3>
      <form novalidate class="create" (submit)="create($event)">
        <label for="new-language-code">{{ 'admin.languages.code' | transloco }}</label>
        <input
          id="new-language-code"
          type="text"
          autocomplete="off"
          spellcheck="false"
          [formField]="newLanguage.code"
          [attr.aria-invalid]="codeBlank() ? 'true' : null"
          [attr.aria-describedby]="
            codeBlank()
              ? 'new-language-code-error new-language-code-help'
              : 'new-language-code-help'
          "
        />
        @if (codeBlank()) {
          <p class="field-error" id="new-language-code-error">
            {{ 'admin.required' | transloco }}
          </p>
        }
        <p class="muso-meta" id="new-language-code-help">
          {{ 'admin.languages.codeHelp' | transloco }}
        </p>
        <label for="new-language-name">{{ 'admin.languages.name' | transloco }}</label>
        <input
          id="new-language-name"
          type="text"
          autocomplete="off"
          [formField]="newLanguage.name"
          [attr.aria-invalid]="nameBlank() ? 'true' : null"
          [attr.aria-describedby]="nameBlank() ? 'new-language-name-error' : null"
        />
        @if (nameBlank()) {
          <p class="field-error" id="new-language-name-error">
            {{ 'admin.required' | transloco }}
          </p>
        }
        @if (writes.errorFor(createTarget); as message) {
          <p class="field-error" role="alert">{{ message }}</p>
        }
        <div class="actions">
          <button type="submit" [disabled]="writes.busy()">
            {{ 'admin.languages.createSubmit' | transloco }}
          </button>
        </div>
      </form>
    </section>

    <div aria-live="polite">
      @if (writes.notice(); as notice) {
        <p class="page-notice muso-notice">{{ notice }}</p>
      }
    </div>

    @if (languages.hasValue()) {
      @if (languages.value().length > 0) {
        <ul class="muso-cards">
          @for (language of languages.value(); track language.id) {
            <li class="language muso-card">
              <h3>{{ language.name }}</h3>
              @if (editing() === language.id) {
                <app-text-form
                  mode="edit"
                  label="admin.languages.name"
                  [initial]="{ text: language.name }"
                  [hint]="'admin.languages.codeFixed' | transloco: { code: language.code }"
                  [busy]="writes.busy()"
                  [error]="writes.errorFor(target(language.id))"
                  (save)="rename(language.id, $event)"
                  (cancel)="closeEdit(language.id)"
                />
              } @else {
                <p class="muso-meta">
                  {{ 'admin.languages.code' | transloco }} :
                  <code class="code">{{ language.code }}</code>
                </p>
                @if (writes.errorFor(target(language.id)); as message) {
                  <p class="field-error" role="alert">{{ message }}</p>
                }
                <div class="actions">
                  <button
                    type="button"
                    class="secondary small"
                    [appFocusReturn]="'rename-language:' + language.id"
                    [disabled]="writes.busy()"
                    [attr.aria-label]="
                      'admin.languages.renameName' | transloco: { language: language.name }
                    "
                    (click)="openEdit(language.id)"
                  >
                    {{ 'admin.languages.rename' | transloco }}
                  </button>
                  <app-confirm-action
                    [small]="true"
                    [label]="'admin.catalog.delete' | transloco"
                    [accessibleName]="
                      'admin.languages.deleteName' | transloco: { language: language.name }
                    "
                    [warning]="
                      'admin.languages.deleteWarning' | transloco: { language: language.name }
                    "
                    [busy]="writes.busy()"
                    (confirmed)="remove(language.id)"
                  />
                </div>
              }
            </li>
          }
        </ul>
      } @else {
        <p class="muso-empty">{{ 'admin.languages.empty' | transloco }}</p>
      }
    } @else if (languages.error()) {
      <app-load-error [error]="languages.error()" (retry)="languages.reload()" />
    } @else {
      <app-loading />
    }
  `,
  styles: `
    h3 {
      margin-block: 0 var(--muso-space-1);
      font-size: var(--muso-body-lg-size);
    }
    input {
      max-inline-size: 32rem;
    }
    .language {
      display: grid;
      gap: var(--muso-space-1);
    }
    .language p {
      margin: 0;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--muso-space-1);
    }
  `,
})
export class LanguagesPage {
  readonly #api = inject(TaxonomyAdminApi);
  readonly #focus = inject(FocusReturn);
  protected readonly writes = inject(AdminWrites);
  protected readonly createTarget = CREATE;

  protected readonly languages = resource({ loader: () => this.#api.languages() });
  protected readonly editing = signal<string | null>(null);

  readonly #model = signal({ code: '', name: '' });
  protected readonly newLanguage = form(this.#model, (path) => {
    validate(path.code, blankIsRequired);
    validate(path.name, blankIsRequired);
  });
  readonly #tried = signal(false);
  protected readonly codeBlank = computed(() => this.#tried() && this.newLanguage.code().invalid());
  protected readonly nameBlank = computed(() => this.#tried() && this.newLanguage.name().invalid());

  protected target(id: string): string {
    return languageTarget(id);
  }

  protected async create(event: Event): Promise<void> {
    event.preventDefault();
    this.#tried.set(true);
    if (this.newLanguage().invalid()) return;
    const { code, name } = this.#model();
    if (await this.#write(CREATE, () => this.#api.createLanguage(code.trim(), name.trim()))) {
      this.#model.set({ code: '', name: '' });
      this.#tried.set(false);
    }
  }

  protected async rename(id: string, name: string): Promise<void> {
    if (await this.#write(languageTarget(id), () => this.#api.renameLanguage(id, name))) {
      this.closeEdit(id);
    }
  }

  protected remove(id: string): void {
    void this.#write(languageTarget(id), () => this.#api.deleteLanguage(id));
  }

  protected openEdit(id: string): void {
    this.writes.clearError(languageTarget(id));
    this.editing.set(id);
  }

  protected closeEdit(id: string): void {
    this.editing.set(null);
    this.writes.clearError(languageTarget(id));
    this.#focus.to(`rename-language:${id}`);
  }

  #write(target: string, call: () => Promise<void>): Promise<boolean> {
    return this.writes.run(target, call, () => reread(this.languages, () => this.#api.languages()));
  }
}
