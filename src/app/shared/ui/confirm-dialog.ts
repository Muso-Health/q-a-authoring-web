import { Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ModalDialog } from './modal-dialog';

/**
 * Asks, in a modal, before an irreversible action. Leaving it any other way than by confirming
 * does nothing; a refusal is shown inside it, so the user can try again or cancel.
 */
@Component({
  selector: 'app-confirm-dialog',
  imports: [TranslocoPipe, ModalDialog],
  template: `
    <app-dialog [title]="title()" [locked]="busy()" (dismissed)="cancel.emit()">
      <p class="warning">{{ warning() }}</p>
      @if (error(); as message) {
        <p class="field-error" role="alert">{{ message }}</p>
      }
      <div class="actions">
        <button type="button" class="danger" [disabled]="busy()" (click)="confirmed.emit()">
          {{ confirmLabel() }}
        </button>
        <button
          type="button"
          class="secondary"
          cdkFocusInitial
          [disabled]="busy()"
          (click)="cancel.emit()"
        >
          {{ 'authoring.cancel' | transloco }}
        </button>
      </div>
    </app-dialog>
  `,
  styles: `
    .warning {
      margin-block-start: 0;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--muso-space-2);
    }
  `,
})
export class ConfirmDialog {
  readonly title = input.required<string>();
  readonly warning = input.required<string>();
  readonly confirmLabel = input.required<string>();
  readonly busy = input(false);
  /** The refusal, already translated. */
  readonly error = input<string | null>(null);
  readonly confirmed = output();
  readonly cancel = output();
}
