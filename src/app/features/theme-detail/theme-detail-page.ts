import {
  Component,
  DOCUMENT,
  PendingTasks,
  computed,
  inject,
  input,
  linkedSignal,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { AUTHOR_QASETS, CurrentUser, MANAGE_CATALOG } from '../../core/access/current-user';
import { CatalogApi } from '../../core/catalog/catalog-api';
import { DocumentationApi, type ThemeDocument } from '../../core/catalog/documentation-api';
import { trailOf } from '../../core/catalog/trail';
import { writeFailureOf } from '../../core/error/write-failure';
import { Translator } from '../../core/i18n/translator';
import { Breadcrumb } from '../../shared/ui/breadcrumb';
import { ConfirmAction } from '../../shared/ui/confirm-action';
import { FileUpload } from '../../shared/ui/file-upload';
import { LoadError, Loading } from '../../shared/ui/load-state';
import { AdminWrites, reread } from '../admin/admin-writes';

/** What the engine takes: PDF, Word, plain text, video, image. A hint only; it decides. */
const ACCEPTED = [
  'application/pdf',
  '.pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc',
  '.docx',
  'text/plain',
  '.txt',
  'video/*',
  'image/*',
].join(',');

const UPLOAD = 'upload';
const documentTarget = (id: string) => `document:${id}`;

/** A size in the reader's words: « 840 octets », « 1,5 Mo ». */
export function formatSize(bytes: number, locale: string): string {
  const [value, unit] =
    bytes < 1_000
      ? [bytes, 'byte']
      : bytes < 1_000_000
        ? [bytes / 1_000, 'kilobyte']
        : bytes < 1_000_000_000
          ? [bytes / 1_000_000, 'megabyte']
          : [bytes / 1_000_000_000, 'gigabyte'];
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit,
    unitDisplay: unit === 'byte' ? 'long' : 'short',
    maximumFractionDigits: 1,
  }).format(value);
}

/**
 * A theme's documentation and its completeness: the documents anyone may read and download, and
 * those with the right may add or remove; then which of their notions no answer covers yet.
 */
@Component({
  selector: 'app-theme-detail-page',
  imports: [TranslocoPipe, Breadcrumb, Loading, LoadError, ConfirmAction, FileUpload],
  providers: [AdminWrites],
  template: `
    @if (lineage.hasValue()) {
      @let l = lineage.value();
      <app-breadcrumb [trail]="l.trail" [current]="'documentation.title' | transloco" />
      <p class="muso-eyebrow">{{ 'documentation.title' | transloco }}</p>
      <h1>{{ l.theme.name }}</h1>

      <section class="documentation" aria-labelledby="documentation-heading">
        <h2 id="documentation-heading">{{ 'documentation.heading' | transloco }}</h2>

        @if (canManage()) {
          <div class="upload muso-card">
            <app-file-upload
              [accept]="accepted"
              [label]="'documentation.upload' | transloco"
              [submitLabel]="'documentation.uploadSubmit' | transloco"
              [busy]="writes.busy()"
              (send)="upload($event)"
            />
            <p class="muso-meta">{{ 'documentation.uploadHelp' | transloco }}</p>
            @if (writes.errorFor(uploadTarget); as message) {
              <p class="field-error" role="alert">{{ message }}</p>
            }
          </div>
        }

        <div aria-live="polite">
          @if (writes.notice(); as notice) {
            <p class="page-notice muso-notice">{{ notice }}</p>
          }
        </div>

        @if (documents.hasValue()) {
          @if (documents.value().length > 0) {
            <ul class="muso-cards">
              @for (doc of documents.value(); track doc.id) {
                <li class="document muso-card">
                  <strong class="filename">{{ doc.filename }}</strong>
                  <p class="muso-meta">
                    {{ doc.mimeType }} · {{ size(doc) }} ·
                    <time [attr.datetime]="doc.createdAt">{{ date(doc) }}</time>
                  </p>
                  @if (downloadFailed() === doc.id) {
                    <p class="field-error" role="alert">
                      {{ 'documentation.downloadFailed' | transloco }}
                    </p>
                  }
                  @if (writes.errorFor(target(doc.id)); as message) {
                    <p class="field-error" role="alert">{{ message }}</p>
                  }
                  <div class="actions">
                    <button
                      type="button"
                      class="secondary small"
                      [disabled]="downloading() === doc.id"
                      [attr.aria-label]="
                        'documentation.downloadName' | transloco: { filename: doc.filename }
                      "
                      (click)="download(doc)"
                    >
                      {{ 'documentation.download' | transloco }}
                    </button>
                    @if (canManage()) {
                      <app-confirm-action
                        [small]="true"
                        [label]="'admin.catalog.delete' | transloco"
                        [accessibleName]="
                          'documentation.deleteName' | transloco: { filename: doc.filename }
                        "
                        [warning]="
                          'documentation.deleteWarning' | transloco: { filename: doc.filename }
                        "
                        [busy]="writes.busy()"
                        (confirmed)="remove(doc.id)"
                      />
                    }
                  </div>
                </li>
              }
            </ul>
          } @else {
            <p class="muso-empty">{{ 'documentation.empty' | transloco }}</p>
          }
        } @else if (documents.error()) {
          <app-load-error [error]="documents.error()" (retry)="documents.reload()" />
        } @else {
          <app-loading />
        }
      </section>

      @if (canAnalyse()) {
        <section class="completeness" aria-labelledby="completeness-heading">
          <h2 id="completeness-heading">{{ 'documentation.completeness.heading' | transloco }}</h2>
          <p class="muso-meta">{{ 'documentation.completeness.lead' | transloco }}</p>
          <button type="button" [disabled]="analysis.isLoading()" (click)="analyse()">
            {{ 'documentation.completeness.run' | transloco }}
          </button>
          <div aria-live="polite">
            @if (analysis.isLoading()) {
              <p class="muso-meta" role="status">
                {{ 'documentation.completeness.running' | transloco }}
              </p>
            } @else if (analysisError(); as key) {
              <p class="field-error" role="alert">{{ key | transloco }}</p>
            } @else if (analysis.hasValue()) {
              @if (analysis.value().length > 0) {
                <h3>{{ 'documentation.completeness.uncovered' | transloco }}</h3>
                <ul class="notions">
                  @for (notion of analysis.value(); track $index) {
                    <li>{{ notion }}</li>
                  }
                </ul>
              } @else {
                <p class="covered muso-notice">
                  {{ 'documentation.completeness.covered' | transloco }}
                </p>
              }
            }
          </div>
        </section>
      }
    } @else if (lineage.error()) {
      <app-load-error [error]="lineage.error()" (retry)="lineage.reload()" />
    } @else {
      <app-loading />
    }
  `,
  styles: `
    section {
      margin-block-start: var(--muso-space-4);
    }
    .upload,
    .document {
      display: grid;
      gap: var(--muso-space-1);
      justify-items: start;
    }
    .upload {
      margin-block-end: var(--muso-space-3);
    }
    .document p,
    .upload p {
      margin: 0;
    }
    .filename {
      overflow-wrap: anywhere;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--muso-space-1);
    }
    .notions {
      margin: 0;
      padding-inline-start: var(--muso-space-3);
    }
    h3 {
      margin-block: var(--muso-space-2) var(--muso-space-1);
      font-size: var(--muso-body-lg-size);
    }
  `,
})
export class ThemeDetailPage {
  readonly #catalog = inject(CatalogApi);
  readonly #docs = inject(DocumentationApi);
  readonly #translator = inject(Translator);
  readonly #window = inject(DOCUMENT).defaultView;
  readonly #tasks = inject(PendingTasks);
  protected readonly writes = inject(AdminWrites);
  protected readonly uploadTarget = UPLOAD;
  protected readonly accepted = ACCEPTED;

  readonly #user = inject(CurrentUser);
  protected readonly canManage = this.#user.can(MANAGE_CATALOG);
  protected readonly canAnalyse = this.#user.can(AUTHOR_QASETS);

  readonly themeId = input.required<string>();

  protected readonly lineage = resource({
    params: () => this.themeId(),
    loader: async ({ params: id }) => {
      const lineage = await this.#catalog.lineageOfTheme(id);
      return { ...lineage, trail: trailOf(lineage) };
    },
  });

  protected readonly documents = resource({
    params: () => this.themeId(),
    loader: ({ params: id }) => this.#docs.list(id),
  });

  /** Nothing runs until asked; each ask is a new run. A new theme starts unasked. */
  readonly #runs = linkedSignal({ source: this.themeId, computation: () => 0 });
  protected readonly analysis = resource({
    params: () => (this.#runs() === 0 ? undefined : { id: this.themeId(), run: this.#runs() }),
    loader: ({ params: { id } }) => this.#docs.completeness(id),
  });
  protected readonly analysisError = computed(() => {
    const error = this.analysis.error();
    return error === undefined ? null : writeFailureOf(error).key;
  });

  protected readonly downloading = signal<string | null>(null);
  protected readonly downloadFailed = signal<string | null>(null);
  private readonly uploader = viewChild(FileUpload);

  protected target(id: string): string {
    return documentTarget(id);
  }

  protected size(doc: ThemeDocument): string {
    return formatSize(doc.sizeBytes, this.#translator.language());
  }

  protected date(doc: ThemeDocument): string {
    return new Intl.DateTimeFormat(this.#translator.language(), { dateStyle: 'medium' }).format(
      new Date(doc.createdAt),
    );
  }

  protected async upload(file: File): Promise<void> {
    const themeId = this.themeId();
    if (await this.#write(UPLOAD, () => this.#docs.upload(themeId, file))) {
      this.uploader()?.clear();
    }
  }

  protected remove(documentId: string): void {
    const themeId = this.themeId();
    void this.#write(documentTarget(documentId), () => this.#docs.remove(themeId, documentId));
  }

  /** A fresh signed URL each time, opened apart from the app. */
  protected async download(doc: ThemeDocument): Promise<void> {
    const done = this.#tasks.add();
    this.downloading.set(doc.id);
    this.downloadFailed.set(null);
    try {
      this.#window?.open(await this.#docs.downloadUrl(doc.id), '_blank', 'noopener');
    } catch {
      this.downloadFailed.set(doc.id);
    } finally {
      this.downloading.set(null);
      done();
    }
  }

  protected analyse(): void {
    this.#runs.update((runs) => runs + 1);
  }

  #write(target: string, call: () => Promise<void>): Promise<boolean> {
    const themeId = this.themeId();
    return this.writes.run(target, call, () =>
      reread(this.documents, () => this.#docs.list(themeId)),
    );
  }
}
