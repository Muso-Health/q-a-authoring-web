import { Component, computed, inject, input, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { CatalogApi } from '../../core/catalog/catalog-api';
import { trailOf } from '../../core/catalog/trail';
import { Translator } from '../../core/i18n/translator';
import { Breadcrumb } from '../../shared/ui/breadcrumb';
import { LoadError, Loading } from '../../shared/ui/load-state';

@Component({
  selector: 'app-theme-page',
  imports: [RouterLink, TranslocoPipe, Breadcrumb, Loading, LoadError],
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
}
