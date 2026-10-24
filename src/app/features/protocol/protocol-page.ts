import { Component, inject, input, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { CatalogApi } from '../../core/catalog/catalog-api';
import { trailOf } from '../../core/catalog/trail';
import { Breadcrumb } from '../../shared/ui/breadcrumb';
import { LoadError, Loading } from '../../shared/ui/load-state';

@Component({
  selector: 'app-protocol-page',
  imports: [RouterLink, TranslocoPipe, Breadcrumb, Loading, LoadError],
  template: `
    @if (page.hasValue()) {
      @let p = page.value();
      <app-breadcrumb [trail]="p.trail" [current]="p.protocol.name" />
      <h1>{{ p.protocol.name }}</h1>
      @if (p.protocol.description) {
        <p class="muso-lead">{{ p.protocol.description }}</p>
      }
      <section aria-labelledby="themes-heading">
        <h2 id="themes-heading">{{ 'browse.protocol.themes' | transloco }}</h2>
        @if (p.themes.length === 0) {
          <p class="muso-empty">{{ 'browse.protocol.empty' | transloco }}</p>
        } @else {
          <ul class="muso-cards">
            @for (theme of p.themes; track theme.id) {
              <li class="muso-card">
                <a class="muso-card-link" [routerLink]="['/themes', theme.id]">{{ theme.name }}</a>
                @if (theme.description) {
                  <p>{{ theme.description }}</p>
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
export class ProtocolPage {
  readonly #catalog = inject(CatalogApi);

  readonly protocolId = input.required<string>();

  protected readonly page = resource({
    params: () => this.protocolId(),
    loader: async ({ params: id }) => {
      const [lineage, themes] = await Promise.all([
        this.#catalog.lineageOfProtocol(id),
        this.#catalog.themes(id),
      ]);
      return { ...lineage, themes, trail: trailOf({ project: lineage.project }) };
    },
  });
}
