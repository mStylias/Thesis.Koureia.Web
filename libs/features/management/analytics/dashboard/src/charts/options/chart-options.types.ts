import type { AnalyticsPeriodViewDto, SeriesSetViewDto } from '@api/analytics';
import type { ChartOption, ChartTokens } from '@ui/chart';

import type { AnalyticsFormat, Translate } from '../../analytics.format.types';

/** Everything an option builder reads besides the series set. Plain data: no DOM, no injector. */
export interface ChartContext {
  /** The resolved theme tokens, from `ChartTheme.tokens()`. */
  readonly tokens: ChartTokens;
  /** `TranslocoService.translate`. Keys are full: `managementDashboard.charts.…`. */
  readonly t: Translate;
  /** Units, dates and axis labels in the active language and the shop's currency. */
  readonly format: AnalyticsFormat;
  /** The `period` of the response the set came from. */
  readonly period: AnalyticsPeriodViewDto;
  /** The active Transloco language. */
  readonly locale: string;
}

/** The shape of every chart's option builder. Pure: a spec calls it with plain objects. */
export type ChartBuilder = (set: SeriesSetViewDto, ctx: ChartContext) => ChartOption;

/** One entry of a chart's legend. `chart-card` draws it as a toggle button. */
export interface ChartLegendItem {
  /** The series name, or the data name of a pie slice. The toggle matches on it. */
  readonly name: string;
  readonly color: string;
  /** A dashed line marker, for a comparison series. */
  readonly dashed?: boolean;
  /** The opacity the series draws with: muted statuses draw lighter. */
  readonly opacity?: number;
}

/** How a status series draws, from `APPOINTMENT_STATUS_SPECS`. */
export interface StatusSeriesStyle {
  readonly color: string;
  readonly opacity: number;
}

/** One line of a tooltip. */
export interface TooltipRow {
  readonly name: string;
  readonly value: string;
  /** The marker color. No marker when it is left out. */
  readonly color?: string;
  readonly dashed?: boolean;
}

/** One bucket of a time axis. */
export interface TimeBucket {
  readonly fromDate: string;
  readonly toDate: string;
}

/** The bar series of a status set and their legend. */
export interface StatusBars {
  readonly series: readonly Record<string, unknown>[];
  readonly legend: readonly ChartLegendItem[];
}
