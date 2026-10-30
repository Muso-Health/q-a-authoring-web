import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ChartPort, type ChartSpec } from '../../core/chart/chart-port';
import { FakeChartPort } from '../../core/chart/testing/fake-chart-port';
import { Chart } from './chart';

const DONUT: ChartSpec = {
  kind: 'donut',
  label: 'Intentions',
  slices: [
    { name: 'Avec', tone: 'complete', value: 3 },
    { name: 'Sans', tone: 'incomplete', value: 1 },
  ],
};

@Component({
  imports: [Chart],
  template: `@if (shown()) {
    <app-chart [spec]="spec()" />
  }`,
})
class Host {
  readonly spec = signal<ChartSpec>(DONUT);
  readonly shown = signal(true);
}

/** Records the observers the chart starts, so a test can say its container resized. */
class FakeResizeObserver {
  static readonly all: FakeResizeObserver[] = [];
  observed: Element[] = [];
  disconnected = false;
  constructor(readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.all.push(this);
  }
  observe(target: Element) {
    this.observed.push(target);
  }
  disconnect() {
    this.disconnected = true;
  }
  fire() {
    this.callback([], this as unknown as ResizeObserver);
  }
}

async function render() {
  FakeResizeObserver.all.length = 0;
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  const port = new FakeChartPort();
  TestBed.configureTestingModule({ providers: [{ provide: ChartPort, useValue: port }] });
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  return { fixture, port, host: fixture.componentInstance };
}

afterEach(() => vi.unstubAllGlobals());

describe('Chart', () => {
  it('draws its spec through the port, into an image named by the spec', async () => {
    const { fixture, port } = await render();

    expect(port.charts).toHaveLength(1);
    expect(port.charts[0].spec).toEqual(DONUT);
    const canvas = fixture.nativeElement.querySelector('[role="img"]');
    expect(canvas.getAttribute('aria-label')).toBe('Intentions');
    expect(port.charts[0].host).toBe(canvas);
  });

  it('redraws the same chart when its spec changes', async () => {
    const { fixture, port, host } = await render();
    const next: ChartSpec = { ...DONUT, label: 'Catégories' };

    host.spec.set(next);
    await fixture.whenStable();

    expect(port.charts).toHaveLength(1);
    expect(port.charts[0].spec).toEqual(next);
  });

  it('resizes with its container', async () => {
    const { port } = await render();

    const observer = FakeResizeObserver.all[0];
    expect(observer.observed).toEqual([port.charts[0].host]);
    observer.fire();

    expect(port.charts[0].resizes).toBe(1);
  });

  it('disposes of its chart, and stops observing, when it goes', async () => {
    const { fixture, port, host } = await render();

    host.shown.set(false);
    await fixture.whenStable();

    expect(port.charts[0].disposed).toBe(true);
    expect(FakeResizeObserver.all[0].disconnected).toBe(true);
  });
});
