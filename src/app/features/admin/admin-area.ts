import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { CurrentUser } from '../../core/access/current-user';
import { ADMIN_SECTIONS } from './admin-sections';

/** The governance area: its sections, each offered only to those who may use it. */
@Component({
  selector: 'app-admin-area',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslocoPipe],
  template: `
    <h1>{{ 'admin.title' | transloco }}</h1>
    <nav class="admin-nav" [attr.aria-label]="'admin.nav.label' | transloco">
      <ul>
        @for (section of sections; track section.path) {
          @if (section.allowed()) {
            <li>
              <a
                [routerLink]="['/admin', section.path]"
                routerLinkActive="active"
                ariaCurrentWhenActive="page"
              >
                {{ section.label | transloco }}
              </a>
            </li>
          }
        }
      </ul>
    </nav>
    <router-outlet />
  `,
  styles: `
    h1 {
      margin-block-end: var(--muso-space-2);
    }
    ul {
      display: flex;
      flex-wrap: wrap;
      gap: var(--muso-space-1);
      margin: 0 0 var(--muso-space-4);
      padding: 0 0 var(--muso-space-1);
      list-style: none;
      border-block-end: 1px solid var(--card-border);
    }
    a {
      display: block;
      padding: var(--muso-space-1) var(--muso-space-2);
      border-radius: var(--muso-radius);
      text-decoration: none;
    }
    a.active {
      background: var(--muso-teal-12);
      font-weight: 600;
    }
  `,
})
export class AdminArea {
  readonly #user = inject(CurrentUser);

  protected readonly sections = ADMIN_SECTIONS.map((section) => ({
    ...section,
    allowed: section.permission === null ? signal(true) : this.#user.can(section.permission),
  }));
}
