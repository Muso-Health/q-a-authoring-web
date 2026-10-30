import type { BarSeriesOption, PieSeriesOption } from 'echarts';
import type { ChartSpec } from './chart-port';
import { toEChartsOption, type ChartColours } from './echarts-options';

const COLOURS: ChartColours = {
  complete: 'rgb(0, 128, 128)',
  incomplete: 'rgb(150, 160, 180)',
  text: 'rgb(10, 20, 60)',
  muted: 'rgb(60, 70, 100)',
  surface: 'rgb(255, 255, 255)',
  grid: 'rgb(220, 224, 232)',
};

const BARS: ChartSpec = {
  kind: 'stacked-bar',
  label: 'Complétude — Français',
  categories: ['Audio', 'Audio validé', 'Validation'],
  series: [
    { name: 'Complet', tone: 'complete', values: [9, 6, 0] },
    { name: 'Incomplet', tone: 'incomplete', values: [3, 6, 0] },
  ],
};

type Datum = { value: number; count: number };

describe('toEChartsOption', () => {
  it('stacks each bar to 100 % of its own total, keeping the counts', () => {
    const option = toEChartsOption(BARS, COLOURS, false);
    const series = option.series as BarSeriesOption[];

    expect(series.map((s) => s.stack)).toEqual(['total', 'total']);
    expect((series[0].data as Datum[]).map((d) => [d.value, d.count])).toEqual([
      [75, 9],
      [50, 6],
      [0, 0],
    ]);
    expect((series[1].data as Datum[]).map((d) => [d.value, d.count])).toEqual([
      [25, 3],
      [50, 6],
      [0, 0],
    ]);
    expect(option.xAxis).toMatchObject({ type: 'value', max: 100 });
    expect(option.yAxis).toMatchObject({ type: 'category', data: BARS.categories });
  });

  it('colours by tone, and textures what is not complete, so colour is never alone', () => {
    const series = toEChartsOption(BARS, COLOURS, false).series as BarSeriesOption[];

    expect(series[0].itemStyle).toMatchObject({ color: COLOURS.complete });
    expect(series[0].itemStyle?.decal).toBeUndefined();
    expect(series[1].itemStyle).toMatchObject({ color: COLOURS.incomplete });
    expect(series[1].itemStyle?.decal).toBeDefined();
  });

  it('turns animation off for whoever asked for reduced motion', () => {
    expect(toEChartsOption(BARS, COLOURS, true).animation).toBe(false);
    expect(toEChartsOption(BARS, COLOURS, false).animation).toBe(true);
  });

  it('draws a donut from its slices, each with its count', () => {
    const option = toEChartsOption(
      {
        kind: 'donut',
        label: 'Intentions',
        slices: [
          { name: 'Avec intention', tone: 'complete', value: 8 },
          { name: 'Sans intention', tone: 'incomplete', value: 4 },
        ],
      },
      COLOURS,
      false,
    );
    const [ring] = option.series as PieSeriesOption[];

    expect(ring.type).toBe('pie');
    expect(ring.radius).toEqual(['55%', '80%']);
    expect(ring.data).toMatchObject([
      { name: 'Avec intention', value: 8, itemStyle: { color: COLOURS.complete } },
      { name: 'Sans intention', value: 4, itemStyle: { color: COLOURS.incomplete } },
    ]);
  });
});
