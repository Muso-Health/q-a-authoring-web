import { ChartPort, type ChartHandle, type ChartSpec } from '../chart-port';

/** One chart the fake drew: what it was last given, and what was done to it since. */
export interface FakeChart {
  readonly host: HTMLElement;
  spec: ChartSpec;
  resizes: number;
  disposed: boolean;
}

/** Records every chart instead of drawing it: tests assert the figures, not pixels. */
export class FakeChartPort extends ChartPort {
  readonly charts: FakeChart[] = [];

  async render(host: HTMLElement, spec: ChartSpec): Promise<ChartHandle> {
    const chart: FakeChart = { host, spec, resizes: 0, disposed: false };
    this.charts.push(chart);
    return {
      update: (next) => (chart.spec = next),
      resize: () => chart.resizes++,
      dispose: () => (chart.disposed = true),
    };
  }

  /** The live chart whose accessible name is `label`. */
  named(label: string): FakeChart | undefined {
    return this.charts.find((chart) => !chart.disposed && chart.spec.label === label);
  }
}
