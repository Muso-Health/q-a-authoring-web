import {
  Component,
  ElementRef,
  afterNextRender,
  input,
  output,
  signal,
  viewChild,
  Injector,
  inject,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * A destructive action that asks first, inline: the trigger gives way to the warning and an
 * explicit confirmation. Focus lands on Cancel, so a stray Enter backs out.
 */
@Component({
  selector: 'app-confirm-action',
  imports: [TranslocoPipe],
  template: `
    @if (asking()) {
      <div
        class="confirm"
        role="group"
        [attr.aria-label]="accessibleName() ?? label()"
        (keydown.escape)="cancel()"
      >
        <p>{{ warning() }}</p>
        <button type="button" class="danger" [disabled]="busy()" (click)="confirm()">
          {{ 'authoring.confirm' | transloco }}
        </button>
        <button #cancelButton type="button" class="secondary" (click)="cancel()">
          {{ 'authoring.cancel' | transloco }}
        </button>
      </div>
    } @else {
      <button
        type="button"
        class="secondary"
        [disabled]="busy()"
        [attr.aria-label]="accessibleName()"
        (click)="ask()"
      >
        {{ label() }}
      </button>
    }
  `,
  styles: `
    .confirm {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--muso-space-1);
      padding: var(--muso-space-2);
      border: 1px solid var(--danger-border);
      border-radius: var(--muso-radius);
      background: var(--danger-bg);
    }
    p {
      flex-basis: 100%;
      margin: 0;
    }
  `,
})
export class ConfirmAction {
  readonly #injector = inject(Injector);

  readonly label = input.required<string>();
  /** When the visible label needs context to be unambiguous ("Supprimer" → "… la variante 2"). */
  readonly accessibleName = input<string>();
  readonly warning = input.required<string>();
  readonly busy = input(false);
  readonly confirmed = output();

  protected readonly asking = signal(false);
  private readonly cancelButton = viewChild<ElementRef<HTMLButtonElement>>('cancelButton');

  protected ask(): void {
    this.asking.set(true);
    afterNextRender(() => this.cancelButton()?.nativeElement.focus(), { injector: this.#injector });
  }

  protected cancel(): void {
    this.asking.set(false);
  }

  protected confirm(): void {
    this.asking.set(false);
    this.confirmed.emit();
  }
}
