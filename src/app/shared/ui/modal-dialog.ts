import { CdkTrapFocus } from '@angular/cdk/a11y';
import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, Directive, inject, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

let nextId = 0;
/** Open dialogs, the last opened last: Escape is the top one's, and the page stays scroll-locked while any is open. */
const open: ModalDialog[] = [];
let savedOverflow = '';

/**
 * The modal every modal is built on: render it inside an `@if` and it opens over the page; leave
 * the `@if` and it closes. Focus is trapped inside it (`cdkFocusInitial` marks where focus starts,
 * else the content's first control) and given back to what opened it; it is labelled by its
 * title. Escape, a click on the backdrop and the close button are a dismissal: `dismissed` asks
 * the owner to leave the `@if`. While `locked` — a call in flight — none of them does anything.
 *
 * Its animation is Angular's own (`animate.enter` / `animate.leave`), on its host: the host is the
 * whole modal layer — backdrop, panel and the content projected into the panel — rendered in
 * place, not portalled elsewhere. So the layer fades in and out as one unit (the panel rising in
 * and sinking out with it) and leaves the DOM only once its leave animation has ended. Under
 * `prefers-reduced-motion: reduce` there is no animation, so it appears and goes at once.
 *
 * Angular waits only on the leave animation of the element the owner's `@if` removes, and does
 * not look inside a component for one. A component whose template is an `<app-dialog>` is what
 * its owner removes, so it must carry the leave itself: `hostDirectives: [DialogHost]`.
 */
@Component({
  selector: 'app-dialog',
  imports: [TranslocoPipe, CdkTrapFocus],
  host: {
    'animate.enter': 'muso-dialog-entering',
    'animate.leave': 'muso-dialog-leaving',
  },
  template: `
    <div class="muso-dialog-backdrop" aria-hidden="true" (click)="dismiss()"></div>
    <div
      class="muso-dialog"
      role="dialog"
      aria-modal="true"
      [attr.aria-labelledby]="titleId"
      cdkTrapFocus
      [cdkTrapFocusAutoCapture]="true"
    >
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
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: var(--muso-z-scrim);
      display: grid;
      place-items: center;
      box-sizing: border-box;
      padding: var(--muso-page-gutter, 16px);
    }
    .muso-dialog-backdrop {
      position: absolute;
      inset: 0;
      background: color-mix(in srgb, var(--muso-navy) 55%, transparent);
    }
    .muso-dialog {
      position: relative;
      box-sizing: border-box;
      inline-size: min(100%, 36rem);
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
    /* The enter / leave animations are global: src/styles/_muso-dialog.scss. */
  `,
})
export class ModalDialog {
  readonly title = input.required<string>();
  /** While true the dialog stays open whatever the user does: something it started is running. */
  readonly locked = input(false);
  /** Escape, the backdrop or the close button: the owner should close the dialog. */
  readonly dismissed = output();

  protected readonly titleId = `dialog-title-${nextId++}`;

  constructor() {
    const document = inject(DOCUMENT);
    const root = document.documentElement;
    // The page behind does not scroll while a modal is open.
    if (open.length === 0) {
      savedOverflow = root.style.overflow;
      root.style.overflow = 'hidden';
    }
    open.push(this);
    // Wherever focus is — even fallen back to <body> — Escape dismisses the top-most dialog only.
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || hasModifier(event) || open.at(-1) !== this) return;
      event.preventDefault();
      this.dismiss();
    };
    document.addEventListener('keydown', onKeydown);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('keydown', onKeydown);
      open.splice(open.indexOf(this), 1);
      if (open.length === 0) root.style.overflow = savedOverflow;
    });
  }

  protected dismiss(): void {
    if (!this.locked()) this.dismissed.emit();
  }
}

const hasModifier = (event: KeyboardEvent) =>
  event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;

/**
 * For a component whose template is an `<app-dialog>` (a confirm, the audio modal…): its host is
 * what the owner's `@if` removes, so it carries the dialog's leave animation — Angular holds it,
 * and the dialog inside, in the DOM until that animation ends.
 */
@Directive({ host: { 'animate.leave': 'muso-dialog-leaving' } })
export class DialogHost {}
