import type { ECElementEvent, EChartsCoreOption, EChartsType } from 'echarts/core';

import type * as ChartECharts from './chart.echarts';

/** An ECharts option object. `lib-chart` sets it whole, with `notMerge`. */
export type ChartOption = EChartsCoreOption;

/** The ECharts params of a click on a mark: the series, the data index, the name, the value. */
export type ChartClickEvent = ECElementEvent;

/** One ECharts instance, as `chart.echarts.ts` creates it. */
export type ChartInstance = EChartsType;

/** The ECharts theme object built from the tokens. */
export type ChartThemeOption = Record<string, unknown>;

/** The module `lib-chart` loads on first render. */
export type ChartModule = typeof ChartECharts;

/** Loads the ECharts module. `CHART_LOADER` holds one. */
export type ChartLoader = () => Promise<ChartModule>;

/** What `lib-chart` adds to every option. */
export interface ChartFrame {
  /** The accessible name. The ECharts `aria` component writes it on the chart. */
  readonly ariaLabel: string;
  /** The entrance length in milliseconds, from `--dur-base`. */
  readonly durationBase: number;
  /** `prefers-reduced-motion: reduce`. Turns the animation off. */
  readonly reducedMotion: boolean;
}
