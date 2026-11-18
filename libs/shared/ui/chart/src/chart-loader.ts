import { InjectionToken } from '@angular/core';

import type { ChartLoader, ChartModule } from './chart.types';

/** One import for every chart in the app. */
let echartsModule: Promise<ChartModule> | undefined;

/** Imports `chart.echarts.ts` on the first call and returns the same promise after that. */
export function loadECharts(): Promise<ChartModule> {
  echartsModule ??= import('./chart.echarts').catch((error: unknown) => {
    // A failed chunk load must not stick. The next chart tries again.
    echartsModule = undefined;
    throw error;
  });
  return echartsModule;
}

/**
 * How `lib-chart` gets ECharts. Replace it in a spec to draw with a fake: jsdom has no layout,
 * and a module mock of a relative path fails under a lowercase drive letter on Windows.
 */
export const CHART_LOADER = new InjectionToken<ChartLoader>('CHART_LOADER', {
  providedIn: 'root',
  factory: () => loadECharts,
});
