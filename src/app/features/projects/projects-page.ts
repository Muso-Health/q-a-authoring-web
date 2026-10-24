import { Component, inject, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { CatalogApi } from '../../core/catalog/catalog-api';
import { LoadError, Loading } from '../../shared/ui/load-state';

@Component({
  selector: 'app-projects-page',
  imports: [RouterLink, TranslocoPipe, Loading, LoadError],
  template: `
    <h1>{{ 'browse.projects.title' | transloco }}</h1>
    @if (page.hasValue()) {
      @let p = page.value();
      @if (p.projects.length === 0) {
        <p class="muso-empty">{{ 'browse.projects.empty' | transloco }}</p>
      } @else {
        <ul class="muso-cards">
          @for (project of p.projects; track project.id) {
            <li class="muso-card">
              <a class="muso-card-link" [routerLink]="['/projects', project.id]">{{
                project.name
              }}</a>
              @if (project.description) {
                <p>{{ project.description }}</p>
              }
              <p class="muso-meta">
                {{ 'browse.baseLanguage' | transloco }} :
                {{ p.languages.of(project.baseLanguageId).name }}
              </p>
            </li>
          }
        </ul>
      }
    } @else if (page.error()) {
      <app-load-error [error]="page.error()" (retry)="page.reload()" />
    } @else {
      <app-loading />
    }
  `,
})
export class ProjectsPage {
  readonly #catalog = inject(CatalogApi);

  protected readonly page = resource({
    loader: async () => {
      const [projects, languages] = await Promise.all([
        this.#catalog.projects(),
        this.#catalog.languages(),
      ]);
      return { projects, languages };
    },
  });
}
