import { Component, computed, inject, resource, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { CurrentUser, MANAGE_GLOSSARY } from '../../../core/access/current-user';
import {
  GlossaryAdminApi,
  type GlossaryFilter,
  type GlossaryForm,
  type GlossaryTerm,
  type GlossaryTermDraft,
} from '../../../core/admin/glossary-admin-api';
import { CatalogApi } from '../../../core/catalog/catalog-api';
import type { Language, LanguageDirectory } from '../../../core/catalog/catalog.model';
import { Translator } from '../../../core/i18n/translator';
import { ConfirmAction } from '../../../shared/ui/confirm-action';
import { FocusReturn, FocusReturnTarget } from '../../../shared/ui/focus-return';
import { LoadError, Loading } from '../../../shared/ui/load-state';
import { AdminWrites, reread } from '../admin-writes';
import { GlossaryFormEditor, type GlossaryFormSave } from './glossary-form-editor';
import { GlossaryImport } from './glossary-import';
import { TermForm } from './term-form';

const PAGE_SIZE = 20;
const STATUSES: readonly GlossaryFilter[] = ['active', 'archived', 'all'];

interface Params {
  readonly status: GlossaryFilter;
  readonly search: string;
  readonly offset: number;
}

interface View {
  readonly terms: readonly GlossaryTerm[];
  readonly total: number;
  /** Where the page stands: not always where it was asked to, once a page has emptied. */
  readonly offset: number;
  readonly languages: LanguageDirectory;
}

const CREATE = 'create';
/** Each doubles as a write target and as the key of what is open for editing. */
const termKey = (termId: string) => `term:${termId}`;
const addKey = (termId: string) => `add:${termId}`;
const formKey = (termId: string, languageId: string) => `form:${termId}:${languageId}`;

const EMPTY: GlossaryTermDraft = { label: '', note: null };

/**
 * The glossary: its terms a page at a time, filtered and searched, each with how it is said in
 * every language. Anyone in the area reads it; whoever manages it also adds (typed in, or imported
 * from a spreadsheet), edits and archives terms, and sets or removes their forms.
 */
@Component({
  selector: 'app-glossary-page',
  imports: [
    TranslocoPipe,
    Loading,
    LoadError,
    TermForm,
    GlossaryFormEditor,
    GlossaryImport,
    ConfirmAction,
    FocusReturnTarget,
  ],
  providers: [AdminWrites],
  template: `
    <h2>{{ 'admin.glossary.title' | transloco }}</h2>

    @if (canManage()) {
      <section class="muso-card" aria-labelledby="create-term-heading">
        <h3 id="create-term-heading">{{ 'admin.glossary.create' | transloco }}</h3>
        <app-term-form
          [initial]="createSeed()"
          [busy]="writes.busy()"
          [error]="writes.errorFor(createTarget)"
          (save)="create($event)"
        />
      </section>
      <app-glossary-import (imported)="page.reload()" />
    }

    <div class="filters" role="search">
      <div>
        <label for="glossary-search">{{ 'admin.glossary.search' | transloco }}</label>
        <input
          id="glossary-search"
          type="search"
          autocomplete="off"
          [value]="query()"
          (input)="search($any($event.target).value)"
        />
      </div>
      <div>
        <label for="glossary-status">{{ 'admin.glossary.status.label' | transloco }}</label>
        <select
          id="glossary-status"
          [value]="status()"
          (change)="filter($any($event.target).value)"
        >
          @for (choice of statuses; track choice) {
            <option [value]="choice" [selected]="choice === status()">
              {{ 'admin.glossary.status.' + choice | transloco }}
            </option>
          }
        </select>
      </div>
    </div>

    <div aria-live="polite">
      @if (writes.notice(); as notice) {
        <p class="page-notice muso-notice">{{ notice }}</p>
      }
    </div>

    @if (page.hasValue()) {
      @let view = page.value();
      @if (view.total > 0) {
        <p class="count muso-meta" aria-live="polite">{{ countLine() }}</p>
      }
      @if (view.terms.length > 0) {
        <ul class="muso-cards">
          @for (term of view.terms; track term.id) {
            <li class="glossary-term muso-card">
              <div class="term-head">
                <h3>{{ term.label }}</h3>
                @if (term.status === 'archived') {
                  <span class="archived-mark">{{ 'admin.glossary.archivedMark' | transloco }}</span>
                }
              </div>

              @if (editing() === termKey(term.id)) {
                <app-term-form
                  mode="edit"
                  [initial]="term"
                  [busy]="writes.busy()"
                  [error]="writes.errorFor(termKey(term.id))"
                  (save)="update(term.id, $event)"
                  (cancel)="close(termKey(term.id))"
                />
              } @else {
                @if (term.note) {
                  <p>{{ term.note }}</p>
                }
                @if (writes.errorFor(termKey(term.id)); as message) {
                  <p class="field-error" role="alert">{{ message }}</p>
                }
                @if (canManage()) {
                  <div class="actions">
                    <button
                      type="button"
                      class="secondary small"
                      [appFocusReturn]="termKey(term.id)"
                      [disabled]="writes.busy()"
                      [attr.aria-label]="
                        'admin.glossary.editName' | transloco: { label: term.label }
                      "
                      (click)="open(termKey(term.id))"
                    >
                      {{ 'admin.catalog.edit' | transloco }}
                    </button>
                    @if (term.status === 'active') {
                      <button
                        type="button"
                        class="secondary small"
                        [disabled]="writes.busy()"
                        [attr.aria-label]="
                          'admin.glossary.archiveName' | transloco: { label: term.label }
                        "
                        (click)="archive(term.id)"
                      >
                        {{ 'admin.glossary.archive' | transloco }}
                      </button>
                    } @else {
                      <button
                        type="button"
                        class="secondary small"
                        [disabled]="writes.busy()"
                        [attr.aria-label]="
                          'admin.glossary.unarchiveName' | transloco: { label: term.label }
                        "
                        (click)="unarchive(term.id)"
                      >
                        {{ 'admin.glossary.unarchive' | transloco }}
                      </button>
                    }
                  </div>
                }
              }

              @if (term.forms.length > 0) {
                <ul class="forms">
                  @for (form of term.forms; track form.languageId) {
                    @let language = view.languages.of(form.languageId);
                    <li class="glossary-form">
                      <!-- The editor names the language it replaces the form in. -->
                      @if (editing() === formKey(term.id, form.languageId)) {
                        <app-glossary-form-editor
                          [fixed]="language"
                          [initial]="form"
                          [busy]="writes.busy()"
                          [error]="writes.errorFor(formKey(term.id, form.languageId))"
                          (save)="setForm(term.id, $event)"
                          (cancel)="close(formKey(term.id, form.languageId))"
                        />
                      } @else {
                        <p class="language">{{ language.name }} ({{ language.code }})</p>
                        <p class="preferred">{{ form.preferred }}</p>
                        @if (form.synonyms.length > 0) {
                          <div class="list">
                            <span class="muso-meta" [id]="listId('synonyms', term, form)">{{
                              'admin.glossary.forms.synonyms' | transloco
                            }}</span>
                            <ul
                              class="muso-chips synonyms"
                              [attr.aria-labelledby]="listId('synonyms', term, form)"
                            >
                              @for (word of form.synonyms; track word) {
                                <li>{{ word }}</li>
                              }
                            </ul>
                          </div>
                        }
                        @if (form.avoid.length > 0) {
                          <div class="list">
                            <span class="muso-meta" [id]="listId('avoid', term, form)">{{
                              'admin.glossary.forms.avoid' | transloco
                            }}</span>
                            <ul
                              class="muso-chips avoid"
                              [attr.aria-labelledby]="listId('avoid', term, form)"
                            >
                              @for (word of form.avoid; track word) {
                                <li>{{ word }}</li>
                              }
                            </ul>
                          </div>
                        }
                        @if (form.note) {
                          <p class="muso-meta">{{ form.note }}</p>
                        }
                        @if (writes.errorFor(formKey(term.id, form.languageId)); as message) {
                          <p class="field-error" role="alert">{{ message }}</p>
                        }
                        @if (canManage()) {
                          <div class="actions">
                            <button
                              type="button"
                              class="secondary small"
                              [appFocusReturn]="formKey(term.id, form.languageId)"
                              [disabled]="writes.busy()"
                              [attr.aria-label]="
                                'admin.glossary.forms.editName'
                                  | transloco: { language: language.name, label: term.label }
                              "
                              (click)="open(formKey(term.id, form.languageId))"
                            >
                              {{ 'admin.catalog.edit' | transloco }}
                            </button>
                            <app-confirm-action
                              [small]="true"
                              [label]="'admin.glossary.forms.remove' | transloco"
                              [accessibleName]="
                                'admin.glossary.forms.removeName'
                                  | transloco: { language: language.name, label: term.label }
                              "
                              [warning]="
                                'admin.glossary.forms.removeWarning'
                                  | transloco: { language: language.name, label: term.label }
                              "
                              [busy]="writes.busy()"
                              (confirmed)="removeForm(term.id, form.languageId)"
                            />
                          </div>
                        }
                      }
                    </li>
                  }
                </ul>
              } @else {
                <p class="muso-meta">{{ 'admin.glossary.forms.none' | transloco }}</p>
              }

              @if (canManage()) {
                @let missing = missingLanguages(term, view.languages);
                @if (editing() === addKey(term.id)) {
                  <div class="adding">
                    <h4>{{ 'admin.glossary.forms.add' | transloco }}</h4>
                    <app-glossary-form-editor
                      [languages]="missing"
                      [busy]="writes.busy()"
                      [error]="writes.errorFor(addKey(term.id))"
                      (save)="setForm(term.id, $event)"
                      (cancel)="close(addKey(term.id))"
                    />
                  </div>
                } @else if (missing.length > 0) {
                  <div class="actions">
                    <button
                      type="button"
                      class="secondary small"
                      [appFocusReturn]="addKey(term.id)"
                      [disabled]="writes.busy()"
                      [attr.aria-label]="
                        'admin.glossary.forms.addName' | transloco: { label: term.label }
                      "
                      (click)="open(addKey(term.id))"
                    >
                      {{ 'admin.glossary.forms.add' | transloco }}
                    </button>
                  </div>
                }
              }
            </li>
          }
        </ul>
      } @else {
        <p class="muso-empty">
          {{ (narrowed() ? 'admin.glossary.noMatch' : 'admin.glossary.empty') | transloco }}
        </p>
      }
      @if (pages() > 1) {
        <nav class="pager" [attr.aria-label]="'admin.glossary.pager' | transloco">
          <button
            type="button"
            class="secondary"
            [disabled]="view.offset === 0"
            (click)="turn(view.offset - pageSize)"
          >
            {{ 'admin.glossary.previous' | transloco }}
          </button>
          <button
            type="button"
            class="secondary"
            [disabled]="view.offset + pageSize >= view.total"
            (click)="turn(view.offset + pageSize)"
          >
            {{ 'admin.glossary.next' | transloco }}
          </button>
        </nav>
      }
    } @else if (page.error()) {
      <app-load-error [error]="page.error()" (retry)="page.reload()" />
    } @else {
      <app-loading />
    }
  `,
  styles: `
    h3 {
      margin: 0;
      font-size: var(--muso-body-lg-size);
    }
    h4 {
      margin-block: 0 var(--muso-space-1);
      font-size: var(--muso-body-size);
    }
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: var(--muso-space-2);
      margin-block: var(--muso-space-3);
    }
    .filters {
      align-items: end;
    }
    .filters > div {
      display: grid;
      gap: var(--muso-space-1);
    }
    .filters > div:first-child {
      flex: 1 1 18rem;
      max-inline-size: 32rem;
    }
    .filters input {
      inline-size: 100%;
    }
    .glossary-term {
      display: grid;
      gap: var(--muso-space-1);
    }
    .glossary-term p {
      margin: 0;
    }
    .term-head {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: var(--muso-space-1);
    }
    .archived-mark {
      padding: 0.05rem var(--muso-space-1);
      border: 1px solid var(--muso-border-strong);
      border-radius: 999px;
      color: var(--muted-fg);
      font-size: var(--muso-caption-size);
    }
    .forms {
      display: grid;
      margin: var(--muso-space-1) 0 0;
      padding: 0;
      list-style: none;
    }
    .glossary-form {
      display: grid;
      gap: 0.35rem;
      padding-block: var(--muso-space-2);
      border-block-start: 1px solid var(--card-border);
    }
    .language {
      color: var(--muted-fg);
      font-size: var(--muso-body-sm-size);
      font-weight: 600;
    }
    .preferred {
      font-weight: 600;
    }
    .list {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--muso-space-1);
    }
    .list .muso-chips {
      margin: 0;
    }
    .muso-chips.avoid > li {
      background: var(--danger-bg);
      border-color: var(--danger-border);
      color: var(--danger-fg);
    }
    .adding {
      padding-block-start: var(--muso-space-2);
      border-block-start: 1px solid var(--card-border);
    }
    .actions,
    .pager {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--muso-space-1);
    }
    .pager {
      margin-block-start: var(--muso-space-3);
    }
  `,
})
export class GlossaryPage {
  readonly #api = inject(GlossaryAdminApi);
  readonly #catalog = inject(CatalogApi);
  readonly #focus = inject(FocusReturn);
  readonly #translator = inject(Translator);
  protected readonly writes = inject(AdminWrites);
  protected readonly canManage = inject(CurrentUser).can(MANAGE_GLOSSARY);

  protected readonly createTarget = CREATE;
  protected readonly statuses = STATUSES;
  protected readonly pageSize = PAGE_SIZE;
  protected readonly termKey = termKey;
  protected readonly addKey = addKey;
  protected readonly formKey = formKey;

  protected readonly query = signal('');
  protected readonly status = signal<GlossaryFilter>('active');
  readonly #offset = signal(0);
  readonly #params = computed<Params>(() => ({
    status: this.status(),
    search: this.query().trim(),
    offset: this.#offset(),
  }));
  /** Something is filtered out: an empty list then means no match, not an empty glossary. */
  protected readonly narrowed = computed(() => {
    const { status, search } = this.#params();
    return status !== 'active' || search !== '';
  });

  protected readonly page = resource({
    params: () => this.#params(),
    loader: ({ params }) => this.#load(params),
  });

  protected readonly pages = computed(() =>
    this.page.hasValue() ? Math.ceil(this.page.value().total / PAGE_SIZE) : 0,
  );
  protected readonly countLine = computed(() => {
    if (!this.page.hasValue()) return '';
    const { total, offset } = this.page.value();
    const pages = this.pages();
    return pages > 1
      ? this.#translator.plural('admin.glossary.countPaged', total, {
          page: Math.floor(offset / PAGE_SIZE) + 1,
          pages,
        })
      : this.#translator.plural('admin.glossary.count', total);
  });

  protected readonly createSeed = signal<GlossaryTermDraft>(EMPTY);
  /** The one editor open: a term's, a form's, or a new form's. */
  protected readonly editing = signal<string | null>(null);

  protected search(query: string): void {
    this.query.set(query);
    this.#offset.set(0);
  }

  protected filter(status: GlossaryFilter): void {
    this.status.set(status);
    this.#offset.set(0);
  }

  protected turn(offset: number): void {
    // After a step back the page stands short of where it was asked to: asking again must read.
    if (offset === this.#offset()) this.page.reload();
    else this.#offset.set(offset);
  }

  protected listId(kind: 'synonyms' | 'avoid', term: GlossaryTerm, form: GlossaryForm): string {
    return `${kind}-${term.id}-${form.languageId}`;
  }

  protected missingLanguages(term: GlossaryTerm, languages: LanguageDirectory): Language[] {
    const present = new Set(term.forms.map((form) => form.languageId));
    return languages.all().filter((language) => !present.has(language.id));
  }

  protected async create(draft: GlossaryTermDraft): Promise<void> {
    if (await this.#write(CREATE, () => this.#api.createTerm(draft))) {
      this.createSeed.set({ ...EMPTY });
    }
  }

  protected async update(termId: string, draft: GlossaryTermDraft): Promise<void> {
    const key = termKey(termId);
    if (await this.#write(key, () => this.#api.updateTerm(termId, draft))) this.close(key);
  }

  protected archive(termId: string): void {
    void this.#write(termKey(termId), () => this.#api.archive(termId));
  }

  protected unarchive(termId: string): void {
    void this.#write(termKey(termId), () => this.#api.unarchive(termId));
  }

  protected async setForm(termId: string, { languageId, draft }: GlossaryFormSave): Promise<void> {
    // Whichever editor sent it: the new form's, or the one of the language being replaced.
    const key = this.editing() === addKey(termId) ? addKey(termId) : formKey(termId, languageId);
    if (await this.#write(key, () => this.#api.setForm(termId, languageId, draft))) {
      this.close(key);
    }
  }

  protected removeForm(termId: string, languageId: string): void {
    void this.#write(formKey(termId, languageId), () => this.#api.removeForm(termId, languageId));
  }

  protected open(key: string): void {
    if (this.editing() !== null) this.writes.clearError(this.editing()!);
    this.writes.clearError(key);
    this.editing.set(key);
  }

  protected close(key: string): void {
    this.editing.set(null);
    this.writes.clearError(key);
    this.#focus.to(key);
  }

  /** Writes only for whoever manages the glossary — the engine refuses the rest all the same. */
  #write(target: string, call: () => Promise<void>): Promise<boolean> {
    if (!this.canManage()) return Promise.resolve(false);
    const params = this.#params();
    return this.writes.run(target, call, () => reread(this.page, () => this.#load(params)));
  }

  async #load(params: Params): Promise<View> {
    const query = { status: params.status, search: params.search, limit: PAGE_SIZE };
    const [languages, first] = await Promise.all([
      this.#catalog.languages(),
      this.#api.terms({ ...query, offset: params.offset }),
    ]);
    if (first.items.length > 0 || params.offset === 0 || first.total === 0) {
      return { languages, terms: first.items, total: first.total, offset: params.offset };
    }
    // The page emptied (archived or removed from under it): show the last one there is.
    const offset = Math.floor((first.total - 1) / PAGE_SIZE) * PAGE_SIZE;
    const last = await this.#api.terms({ ...query, offset });
    return { languages, terms: last.items, total: last.total, offset };
  }
}
