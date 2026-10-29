import { Dialog, type DialogRef } from '@angular/cdk/dialog';
import {
  Component,
  DestroyRef,
  Injector,
  TemplateRef,
  ViewEncapsulation,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

let nextId = 0;

/**
 * The modal every modal is built on: render it inside an `@if` and it opens over the page; leave
 * the `@if` and it closes. The CDK traps focus inside it (`cdkFocusInitial` marks where focus
 * starts, else the first control), labels it by its title, and gives focus back to what opened it.
 * Escape, a click on the overlay and the close button are a dismissal: `dismissed` asks the owner
 * to leave the `@if`. While `locked` — a call in flight — none of them does anything.
 */
@Component({
  selector: 'app-dialog',
  imports: [TranslocoPipe],
  // The overlay and its backdrop live outside this component, at the end of <body>.
  encapsulation: ViewEncapsulation.None,
  template: `
    <ng-template #panel>
      <div class="muso-dialog">
        <div class="muso-dialog-head">
          <h2 class="muso-dialog-title" [id]="titleId">{{ title() }}</h2>
          <button
            type="button"
            class="muso-dialog-close secondary"
            [attr.aria-label]="'dialog.close' | transloco"
            [disabled]="locked()"
            (click)="dismiss()"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <ng-content />
      </div>
    </ng-template>
  `,
  styles: `
    .muso-dialog-backdrop {
      background: color-mix(in srgb, var(--muso-navy) 55%, transparent);
    }
    .muso-dialog {
      box-sizing: border-box;
      max-block-size: calc(100dvh - 2 * var(--muso-page-gutter, 16px));
      overflow-y: auto;
      overflow-wrap: anywhere;
      padding: var(--muso-card-gutter);
      background: var(--muso-surface);
      color: var(--muso-text);
      border-radius: var(--muso-radius);
      border-block-start: 4px solid var(--muso-teal);
      box-shadow: var(--mat-sys-level3);
    }
    .muso-dialog-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--muso-space-2);
      margin-block-end: var(--muso-space-3);
    }
    .muso-dialog-title {
      margin: 0;
    }
    .muso-dialog-close {
      flex: none;
      min-inline-size: 2.75rem;
      min-block-size: 2.75rem;
      padding: 0;
      font-size: 1.5rem;
      line-height: 1;
    }
  `,
})
export class ModalDialog {
  readonly title = input.required<string>();
  /** While true the dialog stays open whatever the user does: something it started is running. */
  readonly locked = input(false);
  /** Escape, the overlay or the close button: the owner should close the dialog. */
  readonly dismissed = output();

  protected readonly titleId = `dialog-title-${nextId++}`;
  private readonly panel = viewChild.required<TemplateRef<unknown>>('panel');
  readonly #ref = signal<DialogRef | null>(null);

  constructor() {
    const dialog = inject(Dialog);
    const injector = inject(Injector);
    let closing = false;

    afterNextRender(() => {
      const ref = dialog.open(this.panel(), {
        injector,
        ariaLabelledBy: this.titleId,
        ariaModal: true,
        autoFocus: 'first-tabbable',
        restoreFocus: true,
        disableClose: this.locked(),
        width: `calc(100vw - 2 * var(--muso-page-gutter, 16px))`,
        maxWidth: '36rem',
        panelClass: 'muso-dialog-pane',
        backdropClass: 'muso-dialog-backdrop',
      });
      ref.closed.subscribe(() => {
        if (!closing) this.dismissed.emit();
      });
      this.#ref.set(ref);
    });

    effect(() => {
      const ref = this.#ref();
      if (ref) ref.disableClose = this.locked();
    });

    inject(DestroyRef).onDestroy(() => {
      closing = true;
      this.#ref()?.close();
    });
  }

  protected dismiss(): void {
    if (!this.locked()) this.#ref()?.close();
  }
}
