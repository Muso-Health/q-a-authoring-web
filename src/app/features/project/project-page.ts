import { Component, inject, input, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { CatalogApi } from '../../core/catalog/catalog-api';
import { Breadcrumb } from '../../shared/ui/breadcrumb';
import { LoadError, Loading } from '../../shared/ui/load-state';
import { ProjectDashboard } from './project-dashboard';

@Component({
  selector: 'app-project-page',
  imports: [RouterLink, TranslocoPipe, Breadcrumb, Loading, LoadError, ProjectDashboard],
  template: `
    @if (page.hasValue()) {
      @let p = page.value();
      <app-breadcrumb [current]="p.project.name" />
      <h1>{{ p.project.name }}</h1>
      @if (p.project.description) {
        <p class="muso-lead">{{ p.project.description }}</p>
      }
      <p class="muso-meta">
        {{ 'browse.baseLanguage' | transloco }} : {{ p.baseLanguage.name }} ({{
          p.baseLanguage.code
        }})
      </p>
      <app-project-dashboard [projectId]="p.project.id" />
      <section aria-labelledby="protocols-heading">
        <h2 id="protocols-heading">{{ 'browse.project.protocols' | transloco }}</h2>
        @if (p.protocols.length === 0) {
          <p class="muso-empty">{{ 'browse.project.empty' | transloco }}</p>
        } @else {
          <ul class="muso-cards">
            @for (protocol of p.protocols; track protocol.id) {
              <li class="muso-card">
                <a class="muso-card-link" [routerLink]="['/protocols', protocol.id]">{{
                  protocol.name
                }}</a>
                @if (protocol.description) {
                  <p>{{ protocol.description }}</p>
                }
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
export class ProjectPage {
  readonly #catalog = inject(CatalogApi);

  readonly projectId = input.required<string>();

  protected readonly page = resource({
    params: () => this.projectId(),
    loader: async ({ params: id }) => {
      const [project, protocols, languages] = await Promise.all([
        this.#catalog.project(id),
        this.#catalog.protocols(id),
        this.#catalog.languages(),
      ]);
      return { project, protocols, baseLanguage: languages.of(project.baseLanguageId) };
    },
  });
}
