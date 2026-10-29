import { Dialog, type DialogRef } from '@angular/cdk/dialog';
import { DOCUMENT } from '@angular/common';
import {
  Component,
  DestroyRef,
  Injector,
  PendingTasks,
  TemplateRef,
  ViewEncapsulation,
  afterNextRender,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

let nextId = 0;

/** How long the fade-out lasts, in step with `muso-dialog-out` below; a safety net past it. */
const LEAVE_MS = 180;

/**
 * The modal every modal is built on: render it inside an `@if` and it opens over the page; leave
 * the `@if` and it closes. The CDK traps focus inside it (`cdkFocusInitial` marks where focus
 * starts, else the content's first control), labels it by its title, and gives focus back to what opened it.
 * Escape, a click on the overlay and the close button are a dismissal: `dismissed` asks the owner
 * to leave the `@if`. While `locked` — a call in flight — none of them does anything.
 *
 * It fades and rises in on open and fades out on close, the backdrop with it; whoever closes it,
 * it leaves the page only once the fade is done. Under `prefers-reduced-motion` it appears and
 * goes at once.
 */
@Component({
  selector: 'app-dialog',
  imports: [TranslocoPipe],
  // The overlay and its backdrop live outside this component, at the end of <body>.
  encapsulation: ViewEncapsulation.None,
  template: `
    <ng-template #panel>
      <div class="muso-dialog">
        <h2 class="muso-dialog-title" [id]="titleId">{{ title() }}</h2>
        <ng-content />
        <!-- Last in the DOM, so focus starts in the content; shown top-right, by the title. -->
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
    </ng-template>
  `,
  styles: `
    .muso-dialog-backdrop {
      background: color-mix(in srgb, var(--muso-navy) 55%, transparent);
    }
    .muso-dialog-pane.muso-dialog-enter {
      animation: muso-dialog-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
    }
    .muso-dialog-pane.muso-dialog-leave {
      animation: muso-dialog-out ${LEAVE_MS}ms ease-in both;
      pointer-events: none;
    }
    .cdk-overlay-backdrop.muso-dialog-backdrop-leave {
      opacity: 0;
      transition: opacity ${LEAVE_MS}ms ease-in;
    }
    @keyframes muso-dialog-in {
      from {
        opacity: 0;
        transform: translateY(1rem) scale(0.95);
      }
    }
    @keyframes muso-dialog-out {
      to {
        opacity: 0;
        transform: translateY(0.5rem) scale(0.97);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .muso-dialog-pane.muso-dialog-enter,
      .muso-dialog-pane.muso-dialog-leave {
        animation: none;
      }
      .cdk-overlay-backdrop.muso-dialog-backdrop-leave {
        transition: none;
      }
    }
    .muso-dialog {
      position: relative;
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
    .muso-dialog-title {
      margin: 0 0 var(--muso-space-3);
      padding-inline-end: 3.25rem;
    }
    .muso-dialog-close {
      position: absolute;
      inset-block-start: var(--muso-card-gutter);
      inset-inline-end: var(--muso-card-gutter);
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
    const tasks = inject(PendingTasks);
    const media = inject(DOCUMENT).defaultView?.matchMedia;
    // Without `matchMedia` (a test environment) nothing can say motion is welcome: none.
    const animate = media ? !media('(prefers-reduced-motion: reduce)').matches : false;
    let closing = false;

    afterNextRender(() => {
      const ref = dialog.open(this.panel(), {
        injector,
        ariaLabelledBy: this.titleId,
        ariaModal: true,
        autoFocus: 'first-tabbable',
        restoreFocus: true,
        // Escape and the overlay are handled below: closing is the owner's, after the fade.
        disableClose: true,
        disableAnimations: !animate,
        width: `calc(100vw - 2 * var(--muso-page-gutter, 16px))`,
        maxWidth: '36rem',
        panelClass: animate ? ['muso-dialog-pane', 'muso-dialog-enter'] : 'muso-dialog-pane',
        backdropClass: 'muso-dialog-backdrop',
      });
      ref.keydownEvents.subscribe((event) => {
        if (event.key === 'Escape' && !hasModifier(event)) {
          event.preventDefault();
          this.dismiss();
        }
      });
      ref.backdropClick.subscribe(() => this.dismiss());
      // Closed from elsewhere — a navigation — is a dismissal too.
      ref.closed.subscribe(() => {
        if (!closing) this.dismissed.emit();
      });
      this.#ref.set(ref);
    });

    inject(DestroyRef).onDestroy(() => {
      closing = true;
      const ref = this.#ref();
      if (!ref) return;
      if (!animate) {
        ref.close();
        return;
      }
      const pane = ref.overlayRef.overlayElement;
      pane.classList.replace('muso-dialog-enter', 'muso-dialog-leave');
      ref.overlayRef.backdropElement?.classList.add('muso-dialog-backdrop-leave');
      // Held as a pending task, so the app (and a test) is stable only once it has gone.
      const done = tasks.add();
      let gone = false;
      const finish = () => {
        if (gone) return;
        gone = true;
        clearTimeout(timer);
        ref.close();
        done();
      };
      pane.addEventListener('animationend', finish, { once: true });
      const timer = setTimeout(finish, LEAVE_MS + 60);
    });
  }

  protected dismiss(): void {
    if (!this.locked()) this.dismissed.emit();
  }
}

const hasModifier = (event: KeyboardEvent) =>
  event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
