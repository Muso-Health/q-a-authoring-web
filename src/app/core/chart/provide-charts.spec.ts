import { TestBed } from '@angular/core/testing';
import { ChartPort } from './chart-port';
import { EChartsChartAdapter } from './echarts-chart-adapter';
import { provideCharts } from './provide-charts';

describe('provideCharts', () => {
  it('binds the port to the ECharts adapter', () => {
    TestBed.configureTestingModule({ providers: [provideCharts()] });

    expect(TestBed.inject(ChartPort)).toBeInstanceOf(EChartsChartAdapter);
  });
});
