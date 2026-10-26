import { NgOptimizedImage } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  ADMIN_PERMISSIONS,
  CurrentUser,
  VALIDATE_AUDIO,
  VALIDATE_CLINICAL,
  VALIDATE_TRANSLATION,
} from '../core/access/current-user';
import { LanguageSwitcher } from './language-switcher';

/** The frame every feature renders into: skip link, banner, navigation, main. */
@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    NgOptimizedImage,
    TranslocoPipe,
    LanguageSwitcher,
  ],
  template: `
    <a class="skip-link" href="#main">{{ 'app.skipToContent' | transloco }}</a>
    <header>
      <img ngSrc="brand/logo-p3_3x.avif" alt="Muso" width="118" height="44" priority />
      <span class="product">{{ 'app.wordmark' | transloco }}</span>
      <!--
        DEFERRED, though at once: the Material menu behind the switcher is its alone, so it loads
        in its own chunk rather than in the initial bundle every screen pays for.
      -->
      @defer (on immediate) {
        <app-language-switcher class="language" />
      }
    </header>
    <div class="body">
      <nav [attr.aria-label]="'nav.label' | transloco">
        <ul>
          <li>
            <a routerLink="/projects" routerLinkActive="active" ariaCurrentWhenActive="page">
              {{ 'nav.projects' | transloco }}
            </a>
          </li>
          @for (queue of queues; track queue.path) {
            @if (queue.allowed()) {
              <li>
                <a [routerLink]="queue.path" routerLinkActive="active" ariaCurrentWhenActive="page">
                  {{ queue.label | transloco }}
                </a>
              </li>
            }
          }
          @if (administers()) {
            <li>
              <a routerLink="/admin" routerLinkActive="active" ariaCurrentWhenActive="page">
                {{ 'nav.admin' | transloco }}
              </a>
            </li>
          }
          <li>
            <a routerLink="/status" routerLinkActive="active" ariaCurrentWhenActive="page">
              {{ 'nav.status' | transloco }}
            </a>
          </li>
        </ul>
      </nav>
      <main id="main" tabindex="-1">
        <router-outlet />
      </main>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-block-size: 100dvh;
    }
    .skip-link {
      position: absolute;
      inset-inline-start: var(--muso-space-2);
      inset-block-start: -10rem;
      z-index: var(--muso-z-skip);
      padding: var(--muso-space-1) var(--muso-space-2);
      background: var(--muso-surface);
    }
    .skip-link:focus {
      inset-block-start: var(--muso-space-2);
    }
    /* Every value the header shows is a charte token; see "The header" in _muso-tokens.scss. */
    header {
      display: flex;
      align-items: center;
      gap: var(--muso-space-3);
      box-sizing: border-box;
      block-size: var(--muso-chrome-block-size);
      padding-inline: var(--muso-page-gutter);
      background: var(--muso-chrome-bg);
      color: var(--muso-chrome-fg);
      border-block-end: var(--muso-chrome-rule);
      --muso-focus: var(--muso-chrome-focus);
    }
    .language {
      margin-inline-start: auto;
    }
    header img {
      block-size: 2rem;
      inline-size: auto;
    }
    .product {
      font-family: var(--muso-font-subheading);
      font-weight: 700;
      font-size: var(--muso-wordmark-size);
      line-height: 1;
    }
    .body {
      display: flex;
      flex: 1;
      flex-wrap: wrap;
    }
    nav {
      flex: 0 0 14rem;
      padding: var(--muso-space-3) var(--muso-space-2);
      border-inline-end: 1px solid var(--card-border);
      background: var(--muso-surface);
    }
    nav ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    nav a {
      display: block;
      padding: var(--muso-space-1) var(--muso-space-2);
      border-radius: var(--muso-radius);
      text-decoration: none;
    }
    nav a.active {
      background: var(--muso-teal-12);
      font-weight: 600;
    }
    main {
      flex: 1 1 20rem;
      background: var(--surface-page);
      min-inline-size: 0;
      padding: var(--muso-space-4) var(--muso-page-gutter);
    }
  `,
})
export class Shell {
  readonly #user = inject(CurrentUser);

  /** Each queue is offered only to those who may validate in it. */
  protected readonly queues = [
    {
      path: '/validation/clinical',
      label: 'nav.clinical',
      allowed: this.#user.can(VALIDATE_CLINICAL),
    },
    {
      path: '/validation/translation',
      label: 'nav.translation',
      allowed: this.#user.can(VALIDATE_TRANSLATION),
    },
    { path: '/validation/audio', label: 'nav.audio', allowed: this.#user.can(VALIDATE_AUDIO) },
  ];

  /** The administration is offered to whoever may use any of its sections. */
  readonly #manages = ADMIN_PERMISSIONS.map((permission) => this.#user.can(permission));
  protected readonly administers = computed(() => this.#manages.some((holds) => holds()));
}
