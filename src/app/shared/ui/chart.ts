import {
  Component,
  DestroyRef,
  ElementRef,
  PendingTasks,
  afterNextRender,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { ChartPort, type ChartHandle, type ChartSpec } from '../../core/chart/chart-port';

/**
 * A chart: a spec in, drawn by whatever `ChartPort` is bound. It follows its container's size,
 * redraws when its spec — or the colour scheme the charte's tokens answer to — changes, and lets
 * go of the chart when it goes. The drawing is an image named by the spec; the figures it shows
 * are for the page around it to also state in text.
 */
@Component({
  selector: 'app-chart',
  template: `<div #canvas class="canvas" role="img" [attr.aria-label]="spec().label"></div>`,
  styles: `
    :host {
      display: block;
      min-inline-size: 0;
    }
    .canvas {
      inline-size: 100%;
      block-size: var(--chart-height, 12rem);
    }
  `,
})
export class Chart {
  readonly #port = inject(ChartPort);
  readonly #tasks = inject(PendingTasks);

  readonly spec = input.required<ChartSpec>();

  private readonly canvas = viewChild.required<ElementRef<HTMLElement>>('canvas');

  #handle: ChartHandle | null = null;
  #gone = false;

  constructor() {
    const cleanups: (() => void)[] = [];
    afterNextRender(() => {
      const host = this.canvas().nativeElement;
      this.#tasks.run(async () => {
        const handle = await this.#port.render(host, this.spec());
        if (this.#gone) return handle.dispose();
        this.#handle = handle;
        // A spec that changed while the library loaded.
        handle.update(this.spec());
      });
      if (typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(() => this.#handle?.resize());
        observer.observe(host);
        cleanups.push(() => observer.disconnect());
      }
      const scheme = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
      if (scheme) {
        const redraw = () => this.#handle?.update(this.spec());
        scheme.addEventListener('change', redraw);
        cleanups.push(() => scheme.removeEventListener('change', redraw));
      }
    });
    effect(() => {
      const spec = this.spec();
      this.#handle?.update(spec);
    });
    inject(DestroyRef).onDestroy(() => {
      this.#gone = true;
      cleanups.forEach((cleanup) => cleanup());
      this.#handle?.dispose();
      this.#handle = null;
    });
  }
}
