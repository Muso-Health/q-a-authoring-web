import { Component, computed, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { loadFailureOf } from '../../core/error/load-failure';

const MESSAGES = {
  'not-found': 'browse.failure.notFound',
  forbidden: 'browse.failure.forbidden',
  unreachable: 'browse.failure.unreachable',
  unexpected: 'browse.failure.unexpected',
} as const;

@Component({
  selector: 'app-loading',
  imports: [TranslocoPipe],
  template: `<p class="muso-meta" role="status">{{ 'browse.loading' | transloco }}</p>`,
})
export class Loading {}

/** A failed read: what it means to the reader, and a retry where retrying can help. */
@Component({
  selector: 'app-load-error',
  imports: [TranslocoPipe],
  template: `
    <div class="muso-notice danger" role="alert">
      <p>{{ message() | transloco }}</p>
      @if (retryable()) {
        <button type="button" (click)="retry.emit()">{{ 'browse.retry' | transloco }}</button>
      }
    </div>
  `,
})
export class LoadError {
  readonly error = input<unknown>();
  readonly retry = output();

  readonly #failure = computed(() => loadFailureOf(this.error()));
  protected readonly message = computed(() => MESSAGES[this.#failure()]);
  protected readonly retryable = computed(() => this.#failure() !== 'not-found');
}
