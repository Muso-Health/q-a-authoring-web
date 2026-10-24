import {
  Directive,
  ElementRef,
  Injector,
  Service,
  afterNextRender,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';

/**
 * Where keyboard focus should go once a panel closes: back to the control that opened it, even
 * when that control is rendered anew by the close. A trigger names itself with
 * `appFocusReturn="key"`; whoever closes the panel calls `to("key")`.
 */
@Service()
export class FocusReturn {
  readonly #pending = signal<string | null>(null);
  readonly pending = this.#pending.asReadonly();

  to(key: string): void {
    this.#pending.set(key);
  }

  done(): void {
    this.#pending.set(null);
  }
}

@Directive({ selector: '[appFocusReturn]' })
export class FocusReturnTarget {
  readonly key = input.required<string>({ alias: 'appFocusReturn' });

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef);
    const focus = inject(FocusReturn);
    const injector = inject(Injector);
    effect(() => {
      if (focus.pending() !== this.key()) return;
      afterNextRender(
        () => {
          host.nativeElement.focus();
          focus.done();
        },
        { injector },
      );
    });
  }
}
