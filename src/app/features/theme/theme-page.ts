import { Component, PendingTasks, computed, inject, input, resource, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AUTHOR_QASETS, CurrentUser } from '../../core/access/current-user';
import { CatalogApi } from '../../core/catalog/catalog-api';
import { LanguageDirectory } from '../../core/catalog/catalog.model';
import { ConceptAuthoringApi } from '../../core/catalog/concept-authoring-api';
import { trailOf } from '../../core/catalog/trail';
import { writeFailureOf } from '../../core/error/write-failure';
import { Translator } from '../../core/i18n/translator';
import { Breadcrumb } from '../../shared/ui/breadcrumb';
import { FocusReturn, FocusReturnTarget } from '../../shared/ui/focus-return';
import { LoadError, Loading } from '../../shared/ui/load-state';
import { TextEditor } from '../../shared/ui/text-editor';
import { QAPairsForm } from './qa-pairs-form';

/** A theme's concepts (« notions »), each with its languages; authors add pairs or a new concept. */
@Component({
  selector: 'app-theme-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    Breadcrumb,
    QAPairsForm,
    TextEditor,
    Loading,
    LoadError,
    FocusReturnTarget,
  ],
  template: `
    @if (page.hasValue()) {
      @let p = page.value();
      @let base = p.languages.of(p.project.baseLanguageId);
      <app-breadcrumb [trail]="p.trail" [current]="p.theme.name" />
      <h1>{{ p.theme.name }}</h1>
      @if (p.theme.description) {
        <p class="muso-lead">{{ p.theme.description }}</p>
      }
      <p>
        <a [routerLink]="['/themes', p.theme.id, 'documentation']">{{
          'documentation.title' | transloco
        }}</a>
      </p>
      <section aria-labelledby="concepts-heading">
        <h2 id="concepts-heading">{{ 'browse.theme.concepts' | transloco }}</h2>
        @if (canAuthor()) {
          <div class="create muso-card">
            <app-qa-pairs-form
              [themeId]="p.theme.id"
              [languageName]="base.name"
              (written)="page.reload()"
            />
          </div>
          <div class="new-concept">
            @if (creating()) {
              <app-text-editor
                [label]="'authoring.answerLabel' | transloco: { language: base.name }"
                [lang]="base.code"
                [saveLabel]="'authoring.newConcept.submit' | transloco"
                [busy]="busy()"
                [error]="createError()"
                (save)="createConcept(p.theme.id, base.id, $event)"
                (cancel)="closeCreate()"
              />
            } @else {
              <button
                type="button"
                class="secondary"
                appFocusReturn="new-concept"
                (click)="creating.set(true)"
              >
                {{ 'authoring.newConcept.open' | transloco }}
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
                <a class="muso-card-link" [routerLink]="['/concepts', row.id]">{{ row.label }}</a>
                @if (row.answer; as answer) {
                  <p class="answer" [attr.lang]="base.code">{{ answer }}</p>
                }
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
  styles: `
    .new-concept {
      margin-block: var(--muso-space-2) var(--muso-space-3);
    }
    .answer {
      margin-block: var(--muso-space-1);
      color: var(--muted-fg);
    }
  `,
})
export class ThemePage {
  readonly #catalog = inject(CatalogApi);
  readonly #authoring = inject(ConceptAuthoringApi);
  readonly #translator = inject(Translator);
  readonly #router = inject(Router);
  readonly #tasks = inject(PendingTasks);
  readonly #focus = inject(FocusReturn);

  protected readonly canAuthor = inject(CurrentUser).can(AUTHOR_QASETS);

  readonly themeId = input.required<string>();

  protected readonly page = resource({
    params: () => this.themeId(),
    loader: async ({ params: id }) => {
      const [lineage, concepts] = await Promise.all([
        this.#catalog.lineageOfTheme(id),
        this.#catalog.concepts(id),
      ]);
      const languages = new LanguageDirectory(
        await this.#catalog.projectLanguages(lineage.project.id),
      );
      const trail = trailOf({ project: lineage.project, protocol: lineage.protocol });
      return { ...lineage, concepts, languages, trail };
    },
  });

  protected readonly creating = signal(false);
  protected readonly busy = signal(false);
  protected readonly createError = signal<string | null>(null);

  protected readonly rows = computed(() => {
    if (!this.page.hasValue()) return [];
    const { concepts, languages, project } = this.page.value();
    const base = project.baseLanguageId;
    return concepts.map((concept, index) => {
      // Base language first, the engine's order otherwise.
      const qasets = [
        ...concept.qasets.filter((q) => q.languageId === base),
        ...concept.qasets.filter((q) => q.languageId !== base),
      ];
      return {
        id: concept.id,
        label: this.#translator.t('browse.theme.conceptLabel', { number: index + 1 }),
        answer: qasets.find((q) => q.languageId === base)?.answerText ?? null,
        languages: qasets.map((q) => ({
          name: languages.of(q.languageId).name,
          variants: this.#translator.plural('browse.theme.variantCount', q.variantCount),
        })),
      };
    });
  });

  /** A concept starts in the base language with its answer; the rest is done on its page. */
  protected async createConcept(themeId: string, languageId: string, text: string): Promise<void> {
    if (this.busy()) return;
    const done = this.#tasks.add();
    this.busy.set(true);
    this.createError.set(null);
    try {
      const conceptId = await this.#authoring.createConcept(themeId, languageId, text);
      await this.#router.navigate(['/concepts', conceptId]);
    } catch (error) {
      this.createError.set(this.#translator.t(writeFailureOf(error).key));
    } finally {
      this.busy.set(false);
      done();
    }
  }

  protected closeCreate(): void {
    this.creating.set(false);
    this.createError.set(null);
    this.#focus.to('new-concept');
  }
}
