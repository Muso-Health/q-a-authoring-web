import { Component, inject, input, resource } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { CatalogApi } from '../../core/catalog/catalog-api';
import { trailOf } from '../../core/catalog/trail';
import { Breadcrumb } from '../../shared/ui/breadcrumb';
import { LoadError, Loading } from '../../shared/ui/load-state';
import { ValidationBadge } from '../../shared/ui/validation-badge';
import { LanguageSection } from './language-section';
import { toQASetView } from './qaset-view';

@Component({
  selector: 'app-qaset-page',
  imports: [TranslocoPipe, Breadcrumb, Loading, LoadError, ValidationBadge, LanguageSection],
  template: `
    @if (page.hasValue()) {
      @let p = page.value();
      @let title = p.view.title ?? ('qaset.untitled' | transloco);
      <app-breadcrumb [trail]="p.trail" [current]="title" />
      <header>
        <p class="muso-eyebrow">{{ 'qaset.eyebrow' | transloco }}</p>
        <h1>{{ title }}</h1>
        <div class="set-meta">
          <app-validation-badge kind="clinical" [status]="p.view.clinical" />
          @if (p.view.categories.length > 0) {
            <ul class="muso-chips" [attr.aria-label]="'qaset.categories' | transloco">
              @for (category of p.view.categories; track category.id) {
                <li>{{ category.name }}</li>
              }
            </ul>
          } @else {
            <span class="muso-meta">{{ 'qaset.noCategories' | transloco }}</span>
          }
        </div>
      </header>

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
            @for (s of p.view.sections; track s.language.id) {
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

      @for (s of p.view.sections; track s.language.id) {
        <app-language-section [section]="s" />
      }
    } @else if (page.error()) {
      <app-load-error [error]="page.error()" (retry)="page.reload()" />
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
  readonly #catalog = inject(CatalogApi);

  readonly qasetId = input.required<string>();

  protected readonly page = resource({
    params: () => this.qasetId(),
    loader: async ({ params: id }) => {
      const detail = await this.#catalog.qaset(id);
      const [lineage, languages] = await Promise.all([
        this.#catalog.lineageOfTheme(detail.theme_id),
        this.#catalog.languages(),
      ]);
      return {
        view: toQASetView(detail, languages, lineage.project.baseLanguageId),
        trail: trailOf(lineage),
      };
    },
  });
}
