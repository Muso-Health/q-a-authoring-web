import { Component, inject, resource } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiPort } from '../../core/api/api-port';
import type { HealthResponse, MeResponse } from '../../core/api/api-types';

/** Proves the wiring end to end: an unauthenticated read (`/health`) and an identified one (`/me`). */
@Component({
  selector: 'app-engine-status',
  imports: [TranslocoPipe],
  template: `
    <h1>{{ 'status.title' | transloco }}</h1>

    <section aria-labelledby="engine-heading">
      <h2 id="engine-heading">{{ 'status.engine' | transloco }}</h2>
      @if (health.hasValue()) {
        <p class="badge up">{{ 'status.up' | transloco }}</p>
      } @else if (health.error()) {
        <p class="badge down" role="alert">{{ 'status.down' | transloco }}</p>
      } @else {
        <p aria-live="polite">{{ 'status.checking' | transloco }}</p>
      }
    </section>

    <section aria-labelledby="identity-heading">
      <h2 id="identity-heading">{{ 'status.identity' | transloco }}</h2>
      @if (me.hasValue()) {
        @let user = me.value();
        <p>
          <strong>{{ user.display_name }}</strong> · <span class="email">{{ user.email }}</span>
        </p>
        <h3>{{ 'status.permissions' | transloco }}</h3>
        @if (user.permissions.length > 0) {
          <ul>
            @for (permission of user.permissions; track permission) {
              <li>
                <code>{{ permission }}</code>
              </li>
            }
          </ul>
        } @else {
          <p>{{ 'status.noPermissions' | transloco }}</p>
        }
      } @else if (me.error()) {
        @if (!health.error()) {
          <p>{{ 'status.unknownUser' | transloco }}</p>
        }
      } @else {
        <p>{{ 'status.checking' | transloco }}</p>
      }
    </section>
  `,
  styles: `
    section {
      margin-block-end: var(--muso-space-4);
    }
    .badge {
      display: inline-block;
      padding: var(--muso-space-1) var(--muso-space-2);
      border-radius: var(--muso-radius);
      font-weight: 600;
    }
    .up {
      background: var(--muso-teal-12);
      color: var(--muso-text);
    }
    .down {
      background: var(--danger-bg);
      color: var(--danger-fg);
      border: 1px solid var(--danger-border);
    }
    .email {
      overflow-wrap: anywhere;
    }
  `,
})
export class EngineStatus {
  readonly #api = inject(ApiPort);

  protected readonly health = resource({
    loader: () => this.#api.get<HealthResponse>('/health'),
  });

  protected readonly me = resource({
    loader: () => this.#api.get<MeResponse>('/me'),
  });
}
