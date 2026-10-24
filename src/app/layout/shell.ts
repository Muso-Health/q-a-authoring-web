import { NgOptimizedImage } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

/** The frame every feature renders into: skip link, banner, navigation, main. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgOptimizedImage, TranslocoPipe],
  template: `
    <a class="skip-link" href="#main">{{ 'app.skipToContent' | transloco }}</a>
    <header>
      <img ngSrc="brand/logo-p3_3x.avif" alt="Muso" width="118" height="44" priority />
      <span class="product">{{ 'app.name' | transloco }}</span>
    </header>
    <div class="body">
      <nav [attr.aria-label]="'nav.label' | transloco">
        <ul>
          <li>
            <a routerLink="/projects" routerLinkActive="active" ariaCurrentWhenActive="page">
              {{ 'nav.projects' | transloco }}
            </a>
          </li>
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
    header {
      display: flex;
      align-items: center;
      gap: var(--muso-space-3);
      padding: var(--muso-space-2) var(--muso-page-gutter);
      background: var(--muso-surface-inverse);
      color: var(--muso-text-inverse);
    }
    header img {
      block-size: 2rem;
      inline-size: auto;
    }
    .product {
      font-family: var(--muso-font-subheading);
      font-weight: 700;
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
export class Shell {}
