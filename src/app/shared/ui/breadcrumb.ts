import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import type { Crumb } from '../../core/catalog/trail';

/** Projects > … ancestors … > the current page. */
@Component({
  selector: 'app-breadcrumb',
  imports: [RouterLink, TranslocoPipe],
  template: `
    <nav [attr.aria-label]="'browse.breadcrumb' | transloco">
      <ol>
        <li>
          <a routerLink="/projects">{{ 'browse.projects.title' | transloco }}</a>
        </li>
        @for (crumb of trail(); track crumb.link.join('/')) {
          <li>
            <a [routerLink]="crumb.link">{{ crumb.label }}</a>
          </li>
        }
        <li>
          <span aria-current="page">{{ current() }}</span>
        </li>
      </ol>
    </nav>
  `,
  styles: `
    ol {
      display: flex;
      flex-wrap: wrap;
      gap: var(--muso-space-1);
      margin: 0 0 var(--muso-space-3);
      padding: 0;
      list-style: none;
      font-size: var(--muso-body-sm-size);
      color: var(--muted-fg);
    }
    li {
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    li + li::before {
      content: '›';
      margin-inline-end: var(--muso-space-1);
      color: var(--muted-fg);
    }
    [aria-current] {
      color: var(--fg);
      font-weight: 600;
    }
  `,
})
export class Breadcrumb {
  readonly trail = input<readonly Crumb[]>([]);
  readonly current = input.required<string>();
}
