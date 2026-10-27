import { Component, PendingTasks, computed, inject, output, resource, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { CurrentUser, MANAGE_GLOSSARY } from '../../../core/access/current-user';
import { GlossaryAdminApi } from '../../../core/admin/glossary-admin-api';
import {
  MissingLabelColumnError,
  UnknownColumnsError,
  termsFromTable,
  type ImportedTerm,
} from '../../../core/admin/glossary-import';
import { CatalogApi } from '../../../core/catalog/catalog-api';
import type { LanguageDirectory } from '../../../core/catalog/catalog.model';
import { writeFailureOf } from '../../../core/error/write-failure';
import { Translator } from '../../../core/i18n/translator';
import {
  EmptyFileError,
  SPREADSHEET_TYPES,
  SpreadsheetImportPort,
  UnreadableFileError,
} from '../../../core/spreadsheet/spreadsheet-import-port';

/** A term the engine refused, by its place in the list reviewed (from 1). */
interface Failure {
  readonly row: number;
  readonly label: string;
  readonly reason: string;
}

/** Where the import stands, as the user is told of it. */
type State =
  | {
      readonly kind: 'review';
      readonly name: string;
      readonly terms: readonly ImportedTerm[];
      readonly languages: LanguageDirectory;
    }
  | { readonly kind: 'empty' | 'unreadable' | 'missingLabel'; readonly name: string }
  | { readonly kind: 'unknownColumns'; readonly name: string; readonly headers: readonly string[] }
  | { readonly kind: 'done'; readonly created: number; readonly failures: readonly Failure[] };

/** What the refusal means to the user. Anything else is a file that could not be read. */
function refusalOf(error: unknown, name: string): State {
  if (error instanceof UnknownColumnsError)
    return { kind: 'unknownColumns', name, headers: error.headers };
  if (error instanceof MissingLabelColumnError) return { kind: 'missingLabel', name };
  if (error instanceof EmptyFileError) return { kind: 'empty', name };
  if (!(error instanceof UnreadableFileError)) console.error(error);
  return { kind: 'unreadable', name };
}

/**
 * Glossary terms from a spreadsheet (.xlsx or .csv), read in the browser: a `label` column, an
 * optional `note`, and a column per language headed by its code, giving the preferred form. The
 * terms read are only listed for review: they are created — one request each — once confirmed.
 */
@Component({
  selector: 'app-glossary-import',
  imports: [TranslocoPipe],
  template: `
    <section class="glossary-import muso-card" aria-labelledby="glossary-import-heading">
      <h3 id="glossary-import-heading">{{ 'admin.glossary.import.title' | transloco }}</h3>
      <p class="muso-meta" id="glossary-import-hint">
        {{ 'admin.glossary.import.hint' | transloco: { codes: codes() } }}
      </p>
      <input
        #picker
        type="file"
        hidden
        [accept]="accepted"
        [disabled]="reading() || creating()"
        (change)="read($event)"
      />
      <div>
        <button
          type="button"
          class="secondary"
          aria-describedby="glossary-import-hint"
          [disabled]="reading() || creating()"
          (click)="picker.click()"
        >
          <span class="with-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 15v4h14v-4" />
            </svg>
            {{ 'admin.glossary.import.choose' | transloco }}
          </span>
        </button>
      </div>

      <div class="import-status" role="status">
        @if (status(); as message) {
          <p class="muso-meta">{{ message }}</p>
        }
      </div>
      @if (alert(); as message) {
        <div class="field-error" role="alert">
          <p>{{ message.lead }}</p>
          @if (message.lines.length > 0) {
            <ul>
              @for (line of message.lines; track $index) {
                <li>{{ line }}</li>
              }
            </ul>
          }
        </div>
      }

      @if (review(); as review) {
        <ol class="review">
          @for (term of review.terms; track $index) {
            <li class="import-term">
              <span class="label">{{ term.label }}</span>
              @if (term.note) {
                <p class="muso-meta">{{ term.note }}</p>
              }
              @if (term.forms.length > 0) {
                <ul class="forms">
                  @for (form of term.forms; track form.languageId) {
                    @let language = review.languages.of(form.languageId);
                    <li>
                      {{
                        'admin.glossary.import.form'
                          | transloco
                            : {
                                language: language.name + ' (' + language.code + ')',
                                preferred: form.preferred,
                              }
                      }}
                    </li>
                  }
                </ul>
              } @else {
                <p class="muso-meta">{{ 'admin.glossary.import.noForms' | transloco }}</p>
              }
            </li>
          }
        </ol>
        <div class="actions">
          <button type="button" [disabled]="creating()" (click)="confirm()">
            {{ confirmLabel() }}
          </button>
          <button type="button" class="secondary" [disabled]="creating()" (click)="dismiss()">
            {{ 'authoring.cancel' | transloco }}
          </button>
        </div>
      }
    </section>
  `,
  styles: `
    .glossary-import {
      display: grid;
      gap: var(--muso-space-1);
      justify-items: start;
    }
    h3 {
      margin: 0;
      font-size: var(--muso-body-lg-size);
    }
    p {
      margin: 0;
    }
    .import-status:empty {
      display: none;
    }
    [role='alert'] ul {
      margin: var(--muso-space-1) 0 0;
      padding-inline-start: 1.25rem;
    }
    svg {
      inline-size: 1.1rem;
      block-size: 1.1rem;
      fill: none;
      stroke: currentColor;
      stroke-width: 2.2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .review {
      display: grid;
      justify-self: stretch;
      margin: 0;
      padding-inline-start: 1.75rem;
    }
    .import-term {
      padding-block: var(--muso-space-1);
      border-block-end: 1px solid var(--card-border);
    }
    .label {
      font-weight: 600;
    }
    .forms {
      margin: 0.25rem 0 0;
      padding: 0;
      list-style: none;
      font-size: var(--muso-body-sm-size);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--muso-space-1);
      margin-block-start: var(--muso-space-1);
    }
  `,
})
export class GlossaryImport {
  readonly #api = inject(GlossaryAdminApi);
  readonly #catalog = inject(CatalogApi);
  readonly #sheets = inject(SpreadsheetImportPort);
  readonly #translator = inject(Translator);
  readonly #tasks = inject(PendingTasks);
  readonly #canManage = inject(CurrentUser).can(MANAGE_GLOSSARY);

  /** Once terms have been created, for the list to be read again. */
  readonly imported = output();

  protected readonly accepted = SPREADSHEET_TYPES;
  protected readonly reading = signal(false);
  protected readonly creating = signal(false);
  readonly #state = signal<State | null>(null);

  readonly #languages = resource({ loader: () => this.#catalog.languages() });
  /** The codes a language column may be headed by. */
  protected readonly codes = computed(() =>
    this.#languages.hasValue()
      ? this.#languages
          .value()
          .all()
          .map((language) => language.code)
          .join(', ')
      : '…',
  );

  protected readonly review = computed(() => {
    const state = this.#state();
    return state?.kind === 'review' ? state : null;
  });

  protected readonly confirmLabel = computed(() =>
    this.#translator.plural('admin.glossary.import.confirm', this.review()?.terms.length ?? 0),
  );

  protected readonly status = computed(() => {
    const t = (key: string) => this.#translator.t(`admin.glossary.import.${key}`);
    if (this.reading()) return t('reading');
    if (this.creating()) return t('creating');
    const state = this.#state();
    if (state?.kind === 'review') {
      return this.#translator.plural('admin.glossary.import.review', state.terms.length, {
        name: state.name,
      });
    }
    if (state?.kind === 'done') {
      return this.#translator.plural('admin.glossary.import.created', state.created);
    }
    return null;
  });

  protected readonly alert = computed((): { lead: string; lines: string[] } | null => {
    const state = this.#state();
    if (state === null || this.reading() || this.creating()) return null;
    const lead = (lead: string) => ({ lead, lines: [] });
    const t = (key: string, params: Record<string, unknown>) =>
      this.#translator.t(`admin.glossary.import.errors.${key}`, params);
    switch (state.kind) {
      case 'review':
        return null;
      case 'done':
        if (state.failures.length === 0) return null;
        return {
          lead: this.#translator.plural('admin.glossary.import.failed', state.failures.length),
          lines: state.failures.map((failure) =>
            this.#translator.t('admin.glossary.import.failure', { ...failure }),
          ),
        };
      case 'empty':
      case 'unreadable':
      case 'missingLabel':
        return lead(t(state.kind, { name: state.name }));
      case 'unknownColumns': {
        const columns = new Intl.ListFormat(this.#translator.language(), {
          type: 'conjunction',
        }).format(state.headers);
        return lead(
          this.#translator.plural(
            'admin.glossary.import.errors.unknownColumns',
            state.headers.length,
            { name: state.name, columns, codes: this.codes() },
          ),
        );
      }
    }
  });

  /** Reads the chosen file into a list to review; one that gives no terms loads nothing. */
  protected async read(event: Event): Promise<void> {
    const picker = event.target as HTMLInputElement;
    const file = picker.files?.[0];
    if (file === undefined) return;
    const done = this.#tasks.add();
    this.reading.set(true);
    try {
      const [table, languages] = await Promise.all([
        this.#sheets.parseTable(file),
        this.#catalog.languages(),
      ]);
      const terms = termsFromTable(table, languages.all());
      this.#state.set({ kind: 'review', name: file.name, terms, languages });
    } catch (error) {
      this.#state.set(refusalOf(error, file.name));
    } finally {
      // The same file, chosen again after a fix, is a new choice.
      picker.value = '';
      this.reading.set(false);
      done();
    }
  }

  /** Creates the terms reviewed, one after the other, and tells which the engine refused. */
  protected async confirm(): Promise<void> {
    const review = this.review();
    if (review === null || !this.#canManage()) return;
    const done = this.#tasks.add();
    this.creating.set(true);
    const failures: Failure[] = [];
    for (const [index, term] of review.terms.entries()) {
      const forms = term.forms.map((form) => ({ ...form, synonyms: [], avoid: [], note: null }));
      try {
        await this.#api.createTerm({ label: term.label, note: term.note }, forms);
      } catch (error) {
        const reason = this.#translator.t(writeFailureOf(error).key);
        failures.push({ row: index + 1, label: term.label, reason });
      }
    }
    const created = review.terms.length - failures.length;
    this.#state.set({ kind: 'done', created, failures });
    this.creating.set(false);
    done();
    if (created > 0) this.imported.emit();
  }

  protected dismiss(): void {
    this.#state.set(null);
  }
}
