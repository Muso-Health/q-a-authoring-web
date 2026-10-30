/**
 * What a chart shows, independent of the library that draws it. Counts, never percentages: the
 * adapter derives the ratios, so the figures the reader sees are always the real ones.
 */

/** A meaning, not a colour: the adapter maps each tone to the charte's data-viz tokens. */
export type ChartTone = 'complete' | 'incomplete';

export interface ChartSeries {
  readonly name: string;
  readonly tone: ChartTone;
  /** One count per category, in the categories' order. */
  readonly values: readonly number[];
}

/** Horizontal bars, each stacked to 100 % of its own total, its counts on its segments. */
export interface StackedBarSpec {
  readonly kind: 'stacked-bar';
  /** The chart's accessible name. */
  readonly label: string;
  readonly categories: readonly string[];
  readonly series: readonly ChartSeries[];
}

export interface ChartSlice {
  readonly name: string;
  readonly tone: ChartTone;
  readonly value: number;
}

/** A ring split into slices, each labelled with its count. */
export interface DonutSpec {
  readonly kind: 'donut';
  readonly label: string;
  readonly slices: readonly ChartSlice[];
}

export type ChartSpec = StackedBarSpec | DonutSpec;

/** One drawn chart: redrawn, resized or let go by whoever drew it. */
export interface ChartHandle {
  update(spec: ChartSpec): void;
  resize(): void;
  dispose(): void;
}

/**
 * Draws charts. An abstract class, so it is both the contract and the injection token; the
 * dashboard depends on this alone, never on the library behind it.
 */
export abstract class ChartPort {
  abstract render(host: HTMLElement, spec: ChartSpec): Promise<ChartHandle>;
}
