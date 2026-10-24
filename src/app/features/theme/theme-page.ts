import { Component, PendingTasks, computed, inject, input, resource, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AUTHOR_QASETS, CurrentUser } from '../../core/access/current-user';
import { CatalogApi } from '../../core/catalog/catalog-api';
import { QASetAuthoringApi } from '../../core/catalog/qaset-authoring-api';
import { trailOf } from '../../core/catalog/trail';
import { writeFailureOf } from '../../core/error/write-failure';
import { Translator } from '../../core/i18n/translator';
import { Breadcrumb } from '../../shared/ui/breadcrumb';
import { FocusReturn, FocusReturnTarget } from '../../shared/ui/focus-return';
import { LanguageAnswerForm, type LanguageAnswer } from '../../shared/ui/language-answer-form';
import { LoadError, Loading } from '../../shared/ui/load-state';

@Component({
  selector: 'app-theme-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    Breadcrumb,
    LanguageAnswerForm,
    Loading,
    LoadError,
    FocusReturnTarget,
  ],
  template: `
    @if (page.hasValue()) {
      @let p = page.value();
      <app-breadcrumb [trail]="p.trail" [current]="p.theme.name" />
      <h1>{{ p.theme.name }}</h1>
      @if (p.theme.description) {
        <p class="muso-lead">{{ p.theme.description }}</p>
      }
      <section aria-labelledby="qasets-heading">
        <h2 id="qasets-heading">{{ 'browse.theme.qasets' | transloco }}</h2>
        @if (canAuthor()) {
          <div class="create muso-card">
            @if (creating()) {
              <app-language-answer-form
                [languages]="p.languages.all()"
                [preselected]="p.project.baseLanguageId"
                [submitLabel]="'authoring.createSet.submit' | transloco"
                [busy]="busy()"
                [error]="createError()"
                (submitted)="create($event)"
                (cancel)="closeCreate()"
              />
            } @else {
              <button type="button" appFocusReturn="create-set" (click)="creating.set(true)">
                {{ 'authoring.createSet.open' | transloco }}
              </button>
            }
          </div>
        }
        @if (rows().length === 0) {
          <p class="muso-empty">{{ 'browse.theme.empty' | transloco }}</p>
        } @else {
          <ul class="muso-cards">
            @for (row of rows(); track row.id) {
              <li class="muso-card">
                <a class="muso-card-link" [routerLink]="['/qasets', row.id]">{{ row.label }}</a>
                <ul class="muso-chips" [attr.aria-label]="'browse.theme.languages' | transloco">
                  @for (language of row.languages; track language.name) {
                    <li>
                      <strong>{{ language.name }}</strong> · {{ language.variants }}
                    </li>
                  }
                </ul>
              </li>
            }
          </ul>
        }
      </section>
    } @else if (page.error()) {
      <app-load-error [error]="page.error()" (retry)="page.reload()" />
    } @else {
      <app-loading />
    }
  `,
})
export class ThemePage {
  readonly #catalog = inject(CatalogApi);
  readonly #translator = inject(Translator);
  readonly #authoring = inject(QASetAuthoringApi);
  readonly #router = inject(Router);
  readonly #tasks = inject(PendingTasks);
  readonly #focus = inject(FocusReturn);

  protected readonly canAuthor = inject(CurrentUser).can(AUTHOR_QASETS);
  protected readonly creating = signal(false);
  protected readonly busy = signal(false);
  protected readonly createError = signal<string | null>(null);

  readonly themeId = input.required<string>();

  protected readonly page = resource({
    params: () => this.themeId(),
    loader: async ({ params: id }) => {
      const [lineage, qasets, languages] = await Promise.all([
        this.#catalog.lineageOfTheme(id),
        this.#catalog.qasets(id),
        this.#catalog.languages(),
      ]);
      const trail = trailOf({ project: lineage.project, protocol: lineage.protocol });
      return { ...lineage, qasets, languages, trail };
    },
  });

  protected readonly rows = computed(() => {
    if (!this.page.hasValue()) return [];
    const { qasets, languages } = this.page.value();
    return qasets.map((qaset, index) => ({
      id: qaset.id,
      label: this.#translator.t('browse.theme.qasetLabel', { number: index + 1 }),
      languages: qaset.languages.map((l) => ({
        name: languages.of(l.languageId).name,
        variants: this.#translator.plural('browse.theme.variantCount', l.variantCount),
      })),
    }));
  });

  /** Create, then open the new QASet; a theme that is gone re-reads the page. */
  protected async create({ languageId, answerText }: LanguageAnswer): Promise<void> {
    const done = this.#tasks.add();
    this.busy.set(true);
    this.createError.set(null);
    try {
      const id = await this.#authoring.createQASet(this.themeId(), languageId, answerText);
      await this.#router.navigate(['/qasets', id]);
    } catch (error) {
      const failure = writeFailureOf(error);
      this.createError.set(this.#translator.t(failure.key));
      if (failure.gone) this.page.reload();
    } finally {
      this.busy.set(false);
      done();
    }
  }

  protected closeCreate(): void {
    this.creating.set(false);
    this.createError.set(null);
    this.#focus.to('create-set');
  }
}
