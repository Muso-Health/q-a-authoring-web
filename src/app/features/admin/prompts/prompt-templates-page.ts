import { Component, inject, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { PromptTemplatesApi } from '../../../core/admin/prompt-templates-api';
import { LoadError, Loading } from '../../../shared/ui/load-state';
import { UpdatedLine } from './updated-line';

/** Every LLM prompt the engine uses, one per use. */
@Component({
  selector: 'app-prompt-templates-page',
  imports: [RouterLink, TranslocoPipe, Loading, LoadError, UpdatedLine],
  template: `
    <h2>{{ 'admin.prompts.title' | transloco }}</h2>
    <p class="muso-lead">{{ 'admin.prompts.lead' | transloco }}</p>
    @if (templates.hasValue()) {
      <ul class="muso-cards">
        @for (template of templates.value(); track template.key) {
          <li class="template muso-card">
            <a class="muso-card-link" [routerLink]="['/admin/prompts', template.key]">
              {{ template.key }}
            </a>
            <ul class="muso-chips" [attr.aria-label]="'admin.prompts.placeholders' | transloco">
              @for (name of template.requiredPlaceholders; track name) {
                <li>
                  <code>{{ braced(name) }}</code>
                </li>
              }
            </ul>
            <app-updated-line [by]="template.updatedBy" [at]="template.updatedAt" />
          </li>
        }
      </ul>
    } @else if (templates.error()) {
      <app-load-error [error]="templates.error()" (retry)="templates.reload()" />
    } @else {
      <app-loading />
    }
  `,
  styles: `
    .template {
      display: grid;
      gap: var(--muso-space-1);
    }
    .muso-chips {
      margin: 0;
    }
  `,
})
export class PromptTemplatesPage {
  readonly #api = inject(PromptTemplatesApi);

  protected readonly templates = resource({ loader: () => this.#api.list() });

  protected braced(name: string): string {
    return `{${name}}`;
  }
}
