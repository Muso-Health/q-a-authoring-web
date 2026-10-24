import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Breadcrumb } from '../../shared/ui/breadcrumb';
import { ConfirmAction } from '../../shared/ui/confirm-action';
import { LanguageAnswerForm, type LanguageAnswer } from '../../shared/ui/language-answer-form';
import { LoadError, Loading } from '../../shared/ui/load-state';
import { Typeahead } from '../../shared/ui/typeahead';
import { ValidationBadge } from '../../shared/ui/validation-badge';
import { LanguageSection } from './language-section';
import { QASetEditor } from './qaset-editor';

@Component({
  selector: 'app-qaset-page',
  imports: [
    TranslocoPipe,
    Breadcrumb,
    ConfirmAction,
    LanguageAnswerForm,
    Loading,
    LoadError,
    ValidationBadge,
    LanguageSection,
    Typeahead,
  ],
  providers: [QASetEditor],
  template: `
    @if (editor.view(); as view) {
      @let title = view.title ?? ('qaset.untitled' | transloco);
      <app-breadcrumb [trail]="editor.trail()" [current]="title" />
      <header>
        <p class="muso-eyebrow">{{ 'qaset.eyebrow' | transloco }}</p>
        <h1>{{ title }}</h1>
        <div class="set-meta">
          <app-validation-badge kind="clinical" [status]="view.clinical" />
          @if (view.categories.length > 0) {
            <ul class="muso-chips" [attr.aria-label]="'qaset.categories' | transloco">
              @for (category of view.categories; track category.id) {
                <li>
                  <span class="chip-label">{{ category.name }}</span>
                  @if (editor.canAuthor()) {
                    <button
                      type="button"
                      class="chip-remove"
                      [disabled]="editor.busy()"
                      [attr.aria-label]="
                        'classification.removeCategory' | transloco: { label: category.name }
                      "
                      (click)="editor.removeCategory(category.id)"
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  }
                </li>
              }
            </ul>
          } @else {
            <span class="muso-meta">{{ 'qaset.noCategories' | transloco }}</span>
          }
          @if (editor.canAuthor() && !addingCategory()) {
            <button
              type="button"
              class="secondary small"
              [disabled]="editor.busy()"
              (click)="addingCategory.set(true)"
            >
              {{ 'classification.addCategory' | transloco }}
            </button>
          }
          @if (editor.canAuthor()) {
            <app-confirm-action
              class="delete-set"
              [label]="'authoring.deleteSet.label' | transloco"
              [warning]="'authoring.deleteSet.warning' | transloco"
              [busy]="editor.busy()"
              (confirmed)="editor.deleteQASet()"
            />
          }
        </div>
        @if (addingCategory()) {
          <app-typeahead
            [label]="'classification.category' | transloco"
            [search]="editor.searchCategories"
            [exclude]="categoryIds()"
            [canCreate]="editor.canCreateCategories()"
            [error]="editor.errorFor('categories')"
            (picked)="addCategory($event.id)"
            (created)="createCategory($event)"
            (cancel)="closeCategory()"
          />
        } @else if (editor.errorFor('categories'); as message) {
          <p class="field-error" role="alert">{{ message }}</p>
        }
        @if (editor.errorFor('qaset'); as message) {
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
              'qaset.coverage.caption' | transloco
            }}
          </caption>
          <thead>
            <tr>
              <th scope="col">{{ 'qaset.coverage.language' | transloco }}</th>
              <th scope="col">{{ 'qaset.counts.variants' | transloco }}</th>
              <th scope="col">{{ 'qaset.counts.withAudio' | transloco }}</th>
              <th scope="col">{{ 'qaset.coverage.answerAudio' | transloco }}</th>
            </tr>
          </thead>
          <tbody>
            @for (s of view.sections; track s.language.id) {
              <tr>
                <th scope="row">{{ s.language.name }}</th>
                <td>{{ s.counts.variants }}</td>
                <td>{{ s.counts.variantsWithAudio }}</td>
                <td>{{ (s.counts.answerHasAudio ? 'qaset.yes' : 'qaset.no') | transloco }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      @for (s of view.sections; track s.language.id) {
        <app-language-section [section]="s" />
      }

      @if (editor.canAuthor()) {
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
            <button type="button" (click)="addingLanguage.set(true)">
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
    .set-meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--muso-space-2);
    }
    .delete-set {
      margin-inline-start: auto;
    }
    .muso-notice {
      margin-block-end: var(--muso-space-3);
    }
    .muso-table-scroll {
      margin-block-end: var(--muso-space-4);
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
export class QASetPage {
  protected readonly editor = inject(QASetEditor);

  readonly qasetId = input.required<string>();

  protected readonly addingLanguage = signal(false);
  protected readonly addingCategory = signal(false);
  protected readonly categoryIds = computed(
    () => this.editor.view()?.categories.map((category) => category.id) ?? [],
  );

  constructor() {
    effect(() => this.editor.qasetId.set(this.qasetId()));
  }

  protected async addLanguage({ languageId, answerText }: LanguageAnswer): Promise<void> {
    if (await this.editor.addLanguage(languageId, answerText)) this.addingLanguage.set(false);
  }

  protected async addCategory(categoryId: string): Promise<void> {
    if (await this.editor.addCategory(categoryId)) this.addingCategory.set(false);
  }

  protected async createCategory(name: string): Promise<void> {
    if (await this.editor.createCategory(name)) this.addingCategory.set(false);
  }

  protected closeCategory(): void {
    this.addingCategory.set(false);
    this.editor.clearError('categories');
  }

  protected closeAddLanguage(): void {
    this.addingLanguage.set(false);
    this.editor.clearError('add-language');
  }
}
