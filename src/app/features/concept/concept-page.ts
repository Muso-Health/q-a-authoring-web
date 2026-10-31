import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Breadcrumb } from '../../shared/ui/breadcrumb';
import { FocusReturn, FocusReturnTarget } from '../../shared/ui/focus-return';
import { Translator } from '../../core/i18n/translator';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog';
import { LoadError, Loading } from '../../shared/ui/load-state';
import { ConceptEditor } from './concept-editor';
import { Toolbar, type ToolbarAction } from '../../shared/ui/toolbar';
import { ConceptCard } from './concept-card';
import { ConceptTagDialog, ConceptTags, type TagKind } from './concept-tags';
import { TranslateForm, type TranslationRequest } from './translate-form';

/**
 * A concept (« notion »), titled by its base-language main question, then what holds across its
 * languages: its categories and intents, with the notion toolbar that changes them or deletes the
 * concept. Then its one card: every language's principal pair, and its variants, a tab per language.
 */
@Component({
  selector: 'app-concept-page',
  imports: [
    TranslocoPipe,
    Breadcrumb,
    ConfirmDialog,
    Loading,
    LoadError,
    ConceptCard,
    ConceptTags,
    ConceptTagDialog,
    Toolbar,
    TranslateForm,
    FocusReturnTarget,
  ],
  providers: [ConceptEditor],
  template: `
    @if (editor.view(); as view) {
      @let title = view.title ?? ('concept.untitled' | transloco);
      <app-breadcrumb [trail]="editor.trail()" [current]="title" />
      <header>
        <p class="muso-eyebrow">{{ 'concept.eyebrow' | transloco }}</p>
        <h1 [attr.lang]="baseCode()">{{ title }}</h1>
        <app-concept-tags kind="categories" />
        <app-concept-tags kind="intents" />
        @if (editor.canAuthor()) {
          <app-toolbar [label]="'tools.concept' | transloco" [actions]="conceptTools()" />
        }
      </header>
      @if (tagDialog(); as open) {
        <app-concept-tag-dialog
          [kind]="open.kind"
          [mode]="open.mode"
          (closed)="closeTagDialog(open.kind, open.mode)"
        />
      }
      @if (deletingConcept()) {
        <app-confirm-dialog
          [title]="'authoring.deleteConcept.title' | transloco"
          [warning]="'authoring.deleteConcept.warning' | transloco"
          [confirmLabel]="'authoring.delete' | transloco"
          [busy]="editor.busy()"
          [error]="editor.errorFor('concept')"
          (confirmed)="editor.deleteConcept()"
          (cancel)="closeDeleteConcept()"
        />
      }

      @if (editor.pageAlert(); as message) {
        <div class="muso-notice danger page-alert" role="alert">
          <p>{{ message }}</p>
        </div>
      }
      @if (editor.resetMessage(); as message) {
        <div class="muso-notice reset-notice" role="status">
          <p>{{ message }}</p>
          <button type="button" class="secondary" (click)="editor.dismissResets()">
            {{ 'authoring.reset.dismiss' | transloco }}
          </button>
        </div>
      }

      <div class="muso-table-scroll" tabindex="0" role="region" aria-labelledby="coverage-caption">
        <table>
          <caption id="coverage-caption">
            {{
              'concept.coverage.caption' | transloco
            }}
          </caption>
          <thead>
            <tr>
              <th scope="col">{{ 'concept.coverage.language' | transloco }}</th>
              <th scope="col">{{ 'concept.counts.variants' | transloco }}</th>
              <th scope="col">{{ 'concept.counts.withAudio' | transloco }}</th>
              <th scope="col">{{ 'concept.coverage.answerAudio' | transloco }}</th>
            </tr>
          </thead>
          <tbody>
            @for (s of view.sections; track s.id) {
              <tr>
                <th scope="row">{{ s.language.name }}</th>
                <td>{{ s.counts.variants }}</td>
                <td>{{ s.counts.variantsWithAudio }}</td>
                <td>{{ (s.counts.answerHasAudio ? 'concept.yes' : 'concept.no') | transloco }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <app-concept-card />

      @if (editor.canAuthor()) {
        <section class="translate-concept muso-card" aria-labelledby="translate-concept-heading">
          <h2 id="translate-concept-heading">
            {{ 'authoring.translateConcept.heading' | transloco }}
          </h2>
          @if (!editor.hasBase()) {
            <p class="muso-meta">{{ 'authoring.translateConcept.noBase' | transloco }}</p>
          } @else if (editor.conceptTargets().length === 0) {
            <p class="muso-meta">{{ 'authoring.translateConcept.none' | transloco }}</p>
          } @else if (translating() && editor.missingLanguages().length > 0) {
            <!-- Only into a language the notion lacks: a present one is translated from its tab. -->
            <p class="muso-meta">{{ 'authoring.translateConcept.missingLead' | transloco }}</p>
            <app-translate-form
              [languages]="editor.missingLanguages()"
              [busy]="editor.busy()"
              [error]="editor.errorFor('translate-concept')"
              (submitted)="translateConcept($event)"
              (cancel)="closeTranslate()"
            />
          } @else {
            @let complete = editor.missingLanguages().length === 0;
            <button
              type="button"
              appFocusReturn="translate-concept"
              [disabled]="editor.busy() || complete"
              [attr.aria-describedby]="complete ? 'translate-concept-complete' : null"
              (click)="translating.set(true)"
            >
              {{ 'authoring.translateConcept.open' | transloco }}
            </button>
            @if (complete) {
              <p id="translate-concept-complete" class="muso-meta">
                {{ 'authoring.translateConcept.complete' | transloco }}
              </p>
            }
          }
        </section>
      }
    } @else if (editor.loadError()) {
      <app-load-error [error]="editor.loadError()" (retry)="editor.retry()" />
    } @else {
      <app-loading />
    }
  `,
  styles: `
    header {
      margin-block-end: var(--muso-space-3);
    }
    h1 {
      margin: 0;
      font-size: var(--muso-body-lg-size);
      line-height: 1.35;
      overflow-wrap: anywhere;
    }
    header .muso-eyebrow {
      margin-block-end: var(--muso-space-1);
    }
    header app-toolbar {
      display: block;
      margin-block-start: var(--muso-space-2);
    }
    .muso-notice {
      margin-block-end: var(--muso-space-3);
    }
    .muso-table-scroll {
      margin-block-end: var(--muso-space-4);
    }
    .translate-concept {
      margin-block-start: var(--muso-space-3);
    }
    caption {
      text-align: start;
      font-weight: 600;
      padding-block-end: var(--muso-space-1);
    }
    td {
      font-weight: 600;
    }
  `,
})
export class ConceptPage {
  protected readonly editor = inject(ConceptEditor);
  readonly #focus = inject(FocusReturn);

  readonly conceptId = input.required<string>();

  readonly #t = inject(Translator);

  /** The title is the base language's main question: it speaks that language. */
  protected readonly baseCode = computed(
    () => this.editor.view()?.sections.find((s) => s.isBase)?.language.code ?? null,
  );

  protected readonly tagDialog = signal<{ kind: TagKind; mode: 'add' | 'remove' } | null>(null);
  protected readonly deletingConcept = signal(false);

  /** What holds for every language: classification, and the concept itself. */
  protected readonly conceptTools = computed<readonly ToolbarAction[]>(() => {
    const busy = this.editor.busy();
    const view = this.editor.view();
    const tag = (
      kind: TagKind,
      mode: 'add' | 'remove',
      icon: ToolbarAction['icon'],
      label: string,
    ) => ({
      id: `${mode}-${kind}`,
      icon,
      label: this.#t.t(label),
      disabled: busy || (mode === 'remove' && (view?.[kind].length ?? 0) === 0),
      handler: () => this.tagDialog.set({ kind, mode }),
    });
    return [
      tag('categories', 'add', 'category-add', 'classification.addCategory'),
      tag('categories', 'remove', 'category-remove', 'tools.removeCategory'),
      tag('intents', 'add', 'intent-add', 'classification.addIntent'),
      tag('intents', 'remove', 'intent-remove', 'tools.removeIntent'),
      {
        id: 'delete-concept',
        icon: 'delete',
        label: this.#t.t('authoring.deleteConcept.label'),
        disabled: busy,
        handler: () => this.deletingConcept.set(true),
      },
    ];
  });
  protected readonly translating = signal(false);

  constructor() {
    effect(() => this.editor.conceptId.set(this.conceptId()));
  }

  protected async translateConcept({
    targetLanguageId,
    engine,
  }: TranslationRequest): Promise<void> {
    if (await this.editor.translateConcept(targetLanguageId, engine)) this.closeTranslate();
  }

  protected closeTagDialog(kind: TagKind, mode: 'add' | 'remove'): void {
    this.tagDialog.set(null);
    this.#focus.to(`${mode}-${kind}`);
  }

  protected closeDeleteConcept(): void {
    this.deletingConcept.set(false);
    this.editor.clearError('concept');
    this.#focus.to('delete-concept');
  }

  protected closeTranslate(): void {
    this.translating.set(false);
    this.editor.clearError('translate-concept');
    this.#focus.to('translate-concept');
  }
}
