import type { Provider } from '@angular/core';
import { ChartPort } from './chart-port';
import { EChartsChartAdapter } from './echarts-chart-adapter';

export function provideCharts(): Provider[] {
  return [{ provide: ChartPort, useClass: EChartsChartAdapter }];
}
