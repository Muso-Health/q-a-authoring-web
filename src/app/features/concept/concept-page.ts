import { Component, effect, inject, input, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Breadcrumb } from '../../shared/ui/breadcrumb';
import { FocusReturn, FocusReturnTarget } from '../../shared/ui/focus-return';
import { ConfirmAction } from '../../shared/ui/confirm-action';
import { LanguageAnswerForm, type LanguageAnswer } from '../../shared/ui/language-answer-form';
import { LoadError, Loading } from '../../shared/ui/load-state';
import { ConceptEditor } from './concept-editor';
import { ConceptTags } from './concept-tags';
import { QASetSection } from './qaset-section';
import { TranslateForm, type TranslationRequest } from './translate-form';

/**
 * A concept (« notion »): what holds across its languages — its intents and categories — then one
 * section per language, each a QASet with its answer, its question variants and their audios.
 */
@Component({
  selector: 'app-concept-page',
  imports: [
    TranslocoPipe,
    Breadcrumb,
    ConfirmAction,
    LanguageAnswerForm,
    Loading,
    LoadError,
    ConceptTags,
    QASetSection,
    TranslateForm,
    FocusReturnTarget,
  ],
  providers: [ConceptEditor],
  template: `
    @if (editor.view(); as view) {
      @let title = view.title ?? ('concept.untitled' | transloco);
      <app-breadcrumb [trail]="editor.trail()" [current]="title" />
      <header>
        <div class="title-row">
          <div>
            <p class="muso-eyebrow">{{ 'concept.eyebrow' | transloco }}</p>
            <h1>{{ title }}</h1>
          </div>
          @if (editor.canAuthor()) {
            <app-confirm-action
              class="delete-concept"
              [label]="'authoring.deleteConcept.label' | transloco"
              [warning]="'authoring.deleteConcept.warning' | transloco"
              [busy]="editor.busy()"
              (confirmed)="editor.deleteConcept()"
            />
          }
        </div>
        <app-concept-tags kind="intents" />
        <app-concept-tags kind="categories" />
        @if (editor.errorFor('concept'); as message) {
          <p class="field-error" role="alert">{{ message }}</p>
        }
      </header>

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

      @for (s of view.sections; track s.id) {
        <app-qaset-section [section]="s" />
      }

      @if (editor.canAuthor()) {
        <section class="translate-concept muso-card" aria-labelledby="translate-concept-heading">
          <h2 id="translate-concept-heading">
            {{ 'authoring.translateConcept.heading' | transloco }}
          </h2>
          @if (!editor.hasBase()) {
            <p class="muso-meta">{{ 'authoring.translateConcept.noBase' | transloco }}</p>
          } @else if (editor.conceptTargets().length === 0) {
            <p class="muso-meta">{{ 'authoring.translateConcept.none' | transloco }}</p>
          } @else if (translating()) {
            <p class="muso-meta">{{ 'authoring.translateConcept.lead' | transloco }}</p>
            <app-translate-form
              [languages]="editor.conceptTargets()"
              [busy]="editor.busy()"
              [error]="editor.errorFor('translate-concept')"
              (submitted)="translateConcept($event)"
              (cancel)="closeTranslate()"
            />
          } @else {
            <button
              type="button"
              appFocusReturn="translate-concept"
              [disabled]="editor.busy()"
              (click)="translating.set(true)"
            >
              {{ 'authoring.translateConcept.open' | transloco }}
            </button>
          }
        </section>

        <section class="add-language muso-card" aria-labelledby="add-language-heading">
          <h2 id="add-language-heading">{{ 'authoring.addLanguage.heading' | transloco }}</h2>
          @if (editor.missingLanguages().length === 0) {
            <p class="muso-meta">{{ 'authoring.addLanguage.none' | transloco }}</p>
          } @else if (addingLanguage()) {
            <app-language-answer-form
              [languages]="editor.missingLanguages()"
              [submitLabel]="'authoring.addLanguage.submit' | transloco"
              [busy]="editor.busy()"
              [error]="editor.errorFor('add-language')"
              (submitted)="addLanguage($event)"
              (cancel)="closeAddLanguage()"
            />
          } @else {
            <button type="button" appFocusReturn="add-language" (click)="addingLanguage.set(true)">
              {{ 'authoring.addLanguage.open' | transloco }}
            </button>
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
    .title-row {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: var(--muso-space-2);
    }
    .delete-concept {
      margin-inline-start: auto;
    }
    .muso-notice {
      margin-block-end: var(--muso-space-3);
    }
    .muso-table-scroll {
      margin-block-end: var(--muso-space-4);
    }
    .translate-concept,
    .add-language {
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

  protected readonly addingLanguage = signal(false);
  protected readonly translating = signal(false);

  constructor() {
    effect(() => this.editor.conceptId.set(this.conceptId()));
  }

  protected async addLanguage({ languageId, answerText }: LanguageAnswer): Promise<void> {
    if (await this.editor.addLanguage(languageId, answerText)) this.closeAddLanguage();
  }

  protected async translateConcept({
    targetLanguageId,
    engine,
  }: TranslationRequest): Promise<void> {
    if (await this.editor.translateConcept(targetLanguageId, engine)) this.closeTranslate();
  }

  protected closeAddLanguage(): void {
    this.addingLanguage.set(false);
    this.editor.clearError('add-language');
    this.#focus.to('add-language');
  }

  protected closeTranslate(): void {
    this.translating.set(false);
    this.editor.clearError('translate-concept');
    this.#focus.to('translate-concept');
  }
}
