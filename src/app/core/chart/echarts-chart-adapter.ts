import { ChartPort, type ChartHandle, type ChartSpec } from './chart-port';
import { toEChartsOption, type ChartColours } from './echarts-options';

type Library = typeof import('./echarts-setup');

/** The tokens each colour comes from, so the charts follow the charte wherever it is re-seeded. */
const TOKENS: Record<keyof ChartColours, string> = {
  complete: '--chart-complete',
  incomplete: '--chart-incomplete',
  text: '--chart-text',
  muted: '--chart-muted',
  surface: '--chart-surface',
  grid: '--chart-grid',
};

/**
 * Resolves a token to a colour the library parses. The charte mixes its tints with `color-mix`,
 * which the browser understands and the library does not: let the browser paint it, then read the
 * pixel back.
 */
function resolve(host: HTMLElement, token: string): string {
  const probe = document.createElement('span');
  probe.style.color = `var(${token})`;
  host.appendChild(probe);
  const css = getComputedStyle(probe).color;
  probe.remove();
  const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  if (!context) return css;
  context.fillStyle = css;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
  return `rgba(${r}, ${g}, ${b}, ${Math.round((a / 255) * 100) / 100})`;
}

const coloursOf = (host: HTMLElement) =>
  Object.fromEntries(
    Object.entries(TOKENS).map(([key, token]) => [key, resolve(host, token)]),
  ) as unknown as ChartColours;

const reducedMotion = () =>
  globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Draws through Apache ECharts, loaded on the first chart. */
export class EChartsChartAdapter extends ChartPort {
  #library?: Promise<Library>;

  async render(host: HTMLElement, spec: ChartSpec): Promise<ChartHandle> {
    const { echarts } = await (this.#library ??= import('./echarts-setup'));
    const chart = echarts.init(host, null, { renderer: 'svg' });
    const draw = (next: ChartSpec) =>
      chart.setOption(toEChartsOption(next, coloursOf(host), reducedMotion()), {
        notMerge: true,
      });
    draw(spec);
    return {
      update: draw,
      resize: () => chart.resize(),
      dispose: () => chart.dispose(),
    };
  }
}
