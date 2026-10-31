import type { BarSeriesOption, EChartsOption, PieSeriesOption } from 'echarts';
import type { ChartSpec, ChartTone, DonutSpec, StackedBarSpec } from './chart-port';

/** The charte's data-viz colours, resolved to values the library can parse. */
export interface ChartColours {
  readonly complete: string;
  readonly incomplete: string;
  readonly text: string;
  readonly muted: string;
  readonly surface: string;
  readonly grid: string;
}

/** A hatch on what is not complete: told apart without trusting colour (WCAG 1.4.1). */
const HATCH = {
  symbol: 'rect',
  symbolSize: 1,
  dashArrayX: [1, 0],
  dashArrayY: [3, 3],
  rotation: Math.PI / 4,
  color: 'rgba(255, 255, 255, 0.45)',
};

const toneOf = (tone: ChartTone, colours: ChartColours) =>
  tone === 'complete' ? colours.complete : colours.incomplete;

const percent = (count: number, total: number) =>
  total === 0 ? 0 : Math.round((count / total) * 1000) / 10;

/** A count is legible on any fill: the text keeps a halo of the surface around it. */
const countLabel = (colours: ChartColours) => ({
  color: colours.text,
  fontWeight: 600 as const,
  textBorderColor: colours.surface,
  textBorderWidth: 3,
});

function stackedBar(spec: StackedBarSpec, colours: ChartColours): EChartsOption {
  const totals = spec.categories.map((_, i) =>
    spec.series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0),
  );
  const series: BarSeriesOption[] = spec.series.map((s) => ({
    type: 'bar',
    name: s.name,
    stack: 'total',
    barMaxWidth: 28,
    data: s.values.map((count, i) => ({ value: percent(count, totals[i]), count })),
    itemStyle: {
      color: toneOf(s.tone, colours),
      borderColor: colours.surface,
      borderWidth: 1,
      ...(s.tone === 'incomplete' ? { decal: HATCH } : {}),
    },
    label: {
      show: true,
      ...countLabel(colours),
      formatter: (p) => {
        const count = (p.data as { count: number }).count;
        return count > 0 ? String(count) : '';
      },
    },
  }));
  return {
    legend: { top: 0, left: 0, textStyle: { color: colours.text } },
    grid: { left: 0, right: 16, top: 32, bottom: 0, containLabel: true },
    tooltip: {
      trigger: 'item',
      formatter: (p) => {
        const item = Array.isArray(p) ? p[0] : p;
        const count = (item.data as { count: number }).count;
        const total = totals[item.dataIndex] ?? 0;
        return `${item.name} — ${item.seriesName} : ${count} / ${total} (${item.value} %)`;
      },
    },
    xAxis: {
      type: 'value',
      max: 100,
      axisLabel: { color: colours.muted, formatter: '{value} %' },
      splitLine: { lineStyle: { color: colours.grid } },
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: [...spec.categories],
      axisTick: { show: false },
      axisLine: { lineStyle: { color: colours.grid } },
      axisLabel: { color: colours.text },
    },
    series,
  };
}

function donut(spec: DonutSpec, colours: ChartColours): EChartsOption {
  const ring: PieSeriesOption = {
    type: 'pie',
    radius: ['55%', '80%'],
    center: ['50%', '45%'],
    avoidLabelOverlap: true,
    data: spec.slices.map((slice) => ({
      name: slice.name,
      value: slice.value,
      itemStyle: {
        color: toneOf(slice.tone, colours),
        borderColor: colours.surface,
        borderWidth: 2,
        ...(slice.tone === 'incomplete' ? { decal: HATCH } : {}),
      },
    })),
    label: { show: true, position: 'inside', ...countLabel(colours), formatter: '{c}' },
    labelLine: { show: false },
  };
  return {
    legend: { bottom: 0, left: 'center', textStyle: { color: colours.text } },
    tooltip: { trigger: 'item', formatter: '{b} : {c} ({d} %)' },
    series: [ring],
  };
}

/** The library's option for a spec: pure, so the mapping is tested without drawing anything. */
export function toEChartsOption(
  spec: ChartSpec,
  colours: ChartColours,
  reducedMotion: boolean,
): EChartsOption {
  const option = spec.kind === 'stacked-bar' ? stackedBar(spec, colours) : donut(spec, colours);
  return {
    ...option,
    animation: !reducedMotion,
    backgroundColor: 'transparent',
    textStyle: { fontFamily: 'inherit' },
    // The host carries the accessible name; the decals need the library's aria module on.
    aria: { enabled: true, label: { enabled: false }, decal: { show: true } },
  };
}
