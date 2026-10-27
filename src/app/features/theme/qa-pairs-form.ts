import {
  Component,
  ElementRef,
  Injector,
  PendingTasks,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { QASetAuthoringApi, type AuthoredPairs } from '../../core/catalog/qaset-authoring-api';
import {
  invalidPairRowsOf,
  isInvalidRequest,
  writeFailureOf,
} from '../../core/error/write-failure';
import { Translator } from '../../core/i18n/translator';
import {
  EmptyFileError,
  MissingColumnError,
  SPREADSHEET_TYPES,
  SpreadsheetImportPort,
  UnreadableFileError,
  type ImportedPair,
  type PairColumn,
} from '../../core/spreadsheet/spreadsheet-import-port';

interface PairRow {
  /** Stable across additions and removals, so a flag stays on the row it was raised for. */
  readonly key: number;
  readonly question: string;
  readonly answer: string;
}

let nextKey = 0;
let nextId = 0;
const emptyRow = (): PairRow => ({ key: nextKey++, question: '', answer: '' });

/** The last spreadsheet import, as the author is told of it. */
type ImportNote =
  | { readonly kind: 'loaded'; readonly name: string; readonly count: number }
  | { readonly kind: 'empty' | 'unreadable'; readonly name: string }
  | {
      readonly kind: 'missingColumns';
      readonly name: string;
      readonly missing: readonly PairColumn[];
    };

/** What the port's refusal means to the author. Anything else is a file that could not be read. */
function importFailureOf(
  error: unknown,
): { kind: 'empty' | 'unreadable' } | { kind: 'missingColumns'; missing: readonly PairColumn[] } {
  if (error instanceof MissingColumnError)
    return { kind: 'missingColumns', missing: error.columns };
  if (error instanceof EmptyFileError) return { kind: 'empty' };
  if (!(error instanceof UnreadableFileError)) console.error(error);
  return { kind: 'unreadable' };
}

/** What was saved, with the skipped rows numbered as the author saw them (from 1). */
interface Outcome extends Omit<AuthoredPairs, 'skippedRows'> {
  readonly skipped: readonly number[];
}

/**
 * Questions and their answers under a theme, several pairs at once, always in the project's base
 * language — so there is no language to choose, and none is sent. The engine groups pairs by
 * answer: one QASet per answer, each question a variant.
 *
 * Rows left entirely blank are dropped; a row with only one of its two halves stops the batch
 * here, before the engine sees it. What the engine says about rows (refused, or skipped as
 * already there) is indexed in the batch as SENT, so it is mapped back to the rows on screen.
 *
 * A spreadsheet (.xlsx or .csv) only PRE-FILLS the rows, read in the browser: the author reviews
 * them, and they go through the same checks and the same Submit as typed ones.
 */
@Component({
  selector: 'app-qa-pairs-form',
  imports: [TranslocoPipe],
  template: `
    <form
      class="pairs"
      novalidate
      [attr.aria-labelledby]="id + '-heading'"
      (submit)="submit($event)"
    >
      <h3 [id]="id + '-heading'">{{ 'authoring.pairs.heading' | transloco }}</h3>
      <p class="muso-meta">
        {{ 'authoring.pairs.lead' | transloco: { language: languageName() } }}
      </p>

      <div class="import">
        <input
          #picker
          type="file"
          hidden
          [accept]="accepted"
          [disabled]="importing()"
          (change)="importFile($event)"
        />
        <button
          type="button"
          class="secondary"
          [disabled]="importing()"
          [attr.aria-describedby]="id + '-import-hint'"
          (click)="picker.click()"
        >
          <span class="with-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 15v4h14v-4" />
            </svg>
            {{ 'authoring.pairs.import' | transloco }}
          </span>
        </button>
        <p class="muso-meta" [id]="id + '-import-hint'">
          {{ 'authoring.pairs.importHint' | transloco }}
        </p>
        <div class="import-status" role="status">
          @if (importStatus(); as message) {
            <p class="muso-meta">{{ message }}</p>
          }
        </div>
        @if (importAlert(); as message) {
          <p class="field-error" role="alert">{{ message }}</p>
        }
      </div>

      @for (row of rows(); track row.key; let i = $index) {
        @let key = row.key;
        @let flagged = flags().has(key);
        <fieldset class="pair" [class.invalid]="flagged">
          <legend>{{ 'authoring.pairs.pair' | transloco: { number: i + 1 } }}</legend>
          <div class="field">
            <label [for]="id + '-q' + key">{{ 'authoring.pairs.question' | transloco }}</label>
            <input
              type="text"
              autocomplete="off"
              [id]="id + '-q' + key"
              [value]="row.question"
              (input)="edit(i, 'question', $event)"
              [attr.aria-invalid]="flagged && isMissing(i, 'question') ? 'true' : null"
              [attr.aria-describedby]="flagged ? id + '-e' + key : null"
            />
          </div>
          <div class="field">
            <label [for]="id + '-a' + key">{{ 'authoring.pairs.answer' | transloco }}</label>
            <textarea
              rows="2"
              [id]="id + '-a' + key"
              [value]="row.answer"
              (input)="edit(i, 'answer', $event)"
              [attr.aria-invalid]="flagged && isMissing(i, 'answer') ? 'true' : null"
              [attr.aria-describedby]="flagged ? id + '-e' + key : null"
            ></textarea>
          </div>
          @if (i > 0) {
            <button
              type="button"
              class="chip-remove remove"
              [attr.aria-label]="'authoring.pairs.remove' | transloco: { number: i + 1 }"
              [title]="'authoring.pairs.remove' | transloco: { number: i + 1 }"
              (click)="remove(i)"
            >
              ×
            </button>
          }
          @if (flagged) {
            <p class="field-error" [id]="id + '-e' + key">
              {{ 'authoring.pairs.incompleteRow' | transloco }}
            </p>
          }
        </fieldset>
      }

      @if (problem(); as key) {
        <p class="field-error" role="alert">{{ key | transloco }}</p>
      }

      <div class="actions">
        <button type="button" class="secondary" (click)="add()">
          <span class="with-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M12 5v14M5 12h14" />
            </svg>
            {{ 'authoring.pairs.add' | transloco }}
          </span>
        </button>
        <button type="submit" [disabled]="busy()">
          {{ 'authoring.pairs.submit' | transloco }}
        </button>
      </div>

      <div class="summary" role="status" [class.muso-notice]="summary() !== null">
        @if (summary(); as lines) {
          @for (line of lines; track $index) {
            <p>{{ line }}</p>
          }
        }
      </div>
    </form>
  `,
  styles: `
    h3 {
      margin: 0;
      font-size: var(--muso-body-lg-size);
    }
    .muso-meta {
      margin: 0 0 var(--muso-space-1);
    }
    .pair {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 2rem;
      gap: var(--muso-space-1) var(--muso-space-2);
      align-items: start;
      margin: 0;
      padding: var(--muso-space-1) var(--muso-space-2) var(--muso-space-2);
    }
    .pair.invalid {
      border-color: var(--danger-border);
      background: var(--danger-bg);
    }
    legend {
      padding-inline: 0.25rem;
      font-size: var(--muso-body-sm-size);
      font-weight: 600;
      color: var(--muso-text-muted);
    }
    .field {
      display: grid;
      gap: 0.25rem;
    }
    input,
    textarea {
      box-sizing: border-box;
      inline-size: 100%;
    }
    textarea {
      resize: vertical;
    }
    [aria-invalid='true'] {
      border-color: var(--danger-fg);
      box-shadow: inset 0 0 0 1px var(--danger-fg);
    }
    /* Beside the first control, level with it: past the label's line. */
    .remove {
      grid-column: 3;
      grid-row: 1;
      inline-size: 2rem;
      block-size: 2rem;
      margin-block-start: 1.6rem;
      font-size: 1.25rem;
    }
    .pair .field-error {
      grid-column: 1 / -1;
    }
    .with-icon {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
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
    .import {
      display: grid;
      gap: var(--muso-space-1);
      justify-items: start;
      margin-block-end: var(--muso-space-1);
      padding-block-end: var(--muso-space-2);
      border-block-end: 1px solid var(--card-border);
    }
    .import p {
      margin: 0;
    }
    .import-status:empty {
      display: none;
    }
    .summary p {
      margin: 0;
    }
    .summary:empty {
      display: none;
    }
    /* Narrow: the answer goes under its question; the remove control stays on the question's line. */
    @media (max-width: 40rem) {
      .pair {
        grid-template-columns: minmax(0, 1fr) 2rem;
      }
      .pair > .field {
        grid-column: 1;
      }
      .remove {
        grid-column: 2;
      }
    }
  `,
})
export class QAPairsForm {
  readonly #authoring = inject(QASetAuthoringApi);
  readonly #sheets = inject(SpreadsheetImportPort);
  readonly #translator = inject(Translator);
  readonly #tasks = inject(PendingTasks);
  readonly #host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly #injector = inject(Injector);
  protected readonly id = `qa-pairs-${nextId++}`;

  readonly themeId = input.required<string>();
  /** The project's base language, named: what the pairs are written in. */
  readonly languageName = input.required<string>();
  /** The theme's QASets changed, or the theme is gone: either way, re-read it. */
  readonly written = output();

  protected readonly rows = signal<readonly PairRow[]>([emptyRow()]);
  protected readonly busy = signal(false);
  /** The i18n key of what stops or refused the batch. */
  protected readonly problem = signal<string | null>(null);
  /** Rows (by key) to complete or clear. */
  protected readonly flags = signal<ReadonlySet<number>>(new Set());
  readonly #outcome = signal<Outcome | null>(null);
  protected readonly accepted = SPREADSHEET_TYPES;
  protected readonly importing = signal(false);
  readonly #imported = signal<ImportNote | null>(null);

  protected readonly importStatus = computed(() => {
    const note = this.#imported();
    if (this.importing()) return this.#translator.t('authoring.pairs.importing');
    if (note?.kind !== 'loaded') return null;
    return this.#translator.plural('authoring.pairs.imported', note.count, { name: note.name });
  });

  protected readonly importAlert = computed(() => {
    const note = this.#imported();
    if (note === null || this.importing()) return null;
    const t = (key: string, params: Record<string, unknown>) =>
      this.#translator.t(`authoring.pairs.errors.${key}`, params);
    switch (note.kind) {
      case 'loaded':
        return null;
      case 'empty':
        return t('importEmpty', { name: note.name });
      case 'unreadable':
        return t('importUnreadable', { name: note.name });
      case 'missingColumns': {
        const columns = new Intl.ListFormat(this.#translator.language(), {
          type: 'conjunction',
        }).format(
          note.missing.map((column) => this.#translator.t(`authoring.pairs.columns.${column}`)),
        );
        return this.#translator.plural(
          'authoring.pairs.errors.importMissingColumns',
          note.missing.length,
          { name: note.name, columns },
        );
      }
    }
  });

  protected readonly summary = computed(() => {
    const outcome = this.#outcome();
    if (outcome === null) return null;
    const plural = (key: string, count: number) =>
      this.#translator.plural(`authoring.pairs.summary.${key}`, count);
    const lines = [
      this.#translator.t('authoring.pairs.summary.saved', {
        created: plural('created', outcome.qasetsCreated),
        updated: plural('updated', outcome.qasetsUpdated),
        variants: plural('variants', outcome.variantsAdded),
      }),
    ];
    if (outcome.skipped.length > 0) {
      const rows = new Intl.ListFormat(this.#translator.language(), { type: 'conjunction' }).format(
        outcome.skipped.map(String),
      );
      lines.push(
        this.#translator.plural('authoring.pairs.summary.skipped', outcome.skipped.length, {
          rows,
        }),
      );
    }
    return lines;
  });

  /** A flagged row's blank half; both, if the engine refused a row that looks whole here. */
  protected isMissing(index: number, half: 'question' | 'answer'): boolean {
    const row = this.rows()[index];
    const blank = (text: string) => text.trim() === '';
    return blank(row[half]) || (!blank(row.question) && !blank(row.answer));
  }

  /**
   * Pairs for the author to review: they replace the untouched starter row, and otherwise come
   * after the rows already there. Nothing is sent.
   */
  load(pairs: readonly ImportedPair[]): void {
    const loaded = pairs.map(({ question, answer }) => ({ key: nextKey++, question, answer }));
    this.rows.update((rows) => {
      const untouched =
        rows.length === 1 && rows[0].question.trim() === '' && rows[0].answer.trim() === '';
      return untouched ? loaded : [...rows, ...loaded];
    });
    this.flags.set(new Set());
    this.problem.set(null);
    this.#outcome.set(null);
  }

  /** Reads the chosen spreadsheet into the rows; a file that gives no pairs changes nothing. */
  protected async importFile(event: Event): Promise<void> {
    const picker = event.target as HTMLInputElement;
    const file = picker.files?.[0];
    if (file === undefined) return;
    const done = this.#tasks.add();
    this.importing.set(true);
    try {
      const pairs = await this.#sheets.parsePairs(file);
      this.load(pairs);
      this.#imported.set({ kind: 'loaded', name: file.name, count: pairs.length });
    } catch (error) {
      this.#imported.set({ ...importFailureOf(error), name: file.name });
    } finally {
      // The same file, chosen again after a fix, is a new choice.
      picker.value = '';
      this.importing.set(false);
      done();
    }
  }

  protected edit(index: number, half: 'question' | 'answer', event: Event): void {
    const text = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    this.rows.update((rows) =>
      rows.map((row, i) => (i === index ? { ...row, [half]: text } : row)),
    );
  }

  protected add(): void {
    this.rows.update((rows) => [...rows, emptyRow()]);
    this.#focusQuestion(this.rows().length - 1);
  }

  /** The first row stays: there is always one to write in. */
  protected remove(index: number): void {
    if (index === 0) return;
    this.rows.update((rows) => rows.filter((_, i) => i !== index));
    this.#focusQuestion(index - 1);
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.busy()) return;
    this.problem.set(null);
    this.flags.set(new Set());
    this.#outcome.set(null);

    const rows = this.rows().map((row, index) => ({
      key: row.key,
      number: index + 1,
      question: row.question.trim(),
      answer: row.answer.trim(),
    }));
    const sent = rows.filter((row) => row.question !== '' || row.answer !== '');
    const incomplete = sent.filter((row) => row.question === '' || row.answer === '');
    if (incomplete.length > 0) {
      this.#flag(
        incomplete.map((row) => row.key),
        'authoring.pairs.incomplete',
      );
      return;
    }
    if (sent.length === 0) {
      this.problem.set('authoring.pairs.empty');
      return;
    }

    const done = this.#tasks.add();
    this.busy.set(true);
    try {
      const { skippedRows, ...counts } = await this.#authoring.authorPairs(
        this.themeId(),
        sent.map(({ question, answer }) => ({ question, answer })),
      );
      const skipped = skippedRows.flatMap((index) => sent[index]?.number ?? []);
      this.#outcome.set({ ...counts, skipped });
      this.rows.set([emptyRow()]);
      this.written.emit();
    } catch (error) {
      const refused = invalidPairRowsOf(error);
      if (refused !== null) {
        const keys = refused.flatMap((index) => sent[index]?.key ?? []);
        this.#flag(keys, 'authoring.pairs.errors.invalidPairs');
      } else if (isInvalidRequest(error)) {
        this.problem.set('authoring.pairs.errors.invalidRequest');
      } else {
        const failure = writeFailureOf(error);
        this.problem.set(failure.key);
        if (failure.gone) this.written.emit();
      }
    } finally {
      this.busy.set(false);
      done();
    }
  }

  #flag(keys: readonly number[], problem: string): void {
    this.flags.set(new Set(keys));
    this.problem.set(problem);
  }

  #focusQuestion(index: number): void {
    afterNextRender(
      () =>
        this.#host.nativeElement
          .querySelectorAll<HTMLInputElement>('fieldset.pair input')
          .item(index)
          ?.focus(),
      { injector: this.#injector },
    );
  }
}
