import type { SeriesSetViewDto } from '@api/analytics';
import type { ChartOption } from '@ui/chart';

import {
  baseOption,
  categoryAxis,
  labelInterval,
  tooltipHtml,
  tooltipIndex,
  tooltipSeries,
  valueAxis,
} from './chart-base';
import { swatch } from './chart-colors';
import { seriesName, seriesValues } from './chart-data';
import type { ChartContext } from './chart-options.types';

/** The most hour labels an axis shows. 13 hours side by side leave no gap in a half-width card. */
export const HOUR_LABELS = 7;

/** The axis items of an hour set as `09:00`. The chart and its table both read them. */
export function hourLabels(set: SeriesSetViewDto, ctx: ChartContext): string[] {
  return set.axis.items.map((item) => ctx.format.hour(item.key));
}

/** A category axis over hour labels. A long day labels every second hour. */
export function hourAxis(labels: readonly string[]): Record<string, unknown> {
  const axis = categoryAxis(labels);
  return {
    ...axis,
    axisLabel: {
      ...(axis['axisLabel'] as Record<string, unknown>),
      interval: labelInterval(labels.length, HOUR_LABELS),
    },
  };
}

/**
 * `busiestHours`: one bar per hour of the day, from the earliest to the latest hour with a
 * booking or opening hours. The axis keys are hours, `"9"` to `"20"`.
 */
export function busiestHoursOption(set: SeriesSetViewDto, ctx: ChartContext): ChartOption {
  const labels = hourLabels(set, ctx);
  const appointments = seriesValues(set, 'appointments');
  const color = swatch(ctx, 0);
  const name = seriesName('appointments', ctx);

  return {
    ...baseOption(ctx),
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: unknown) => {
        const index = tooltipIndex(params);
        const shown = tooltipSeries(params).length > 0;
        return tooltipHtml(
          labels[index] ?? '',
          shown ? [{ name, value: ctx.format.tooltip(appointments[index], 'Count'), color }] : [],
        );
      },
    },
    xAxis: hourAxis(labels),
    yAxis: valueAxis('Count', ctx, { minInterval: 1 }),
    series: [{ type: 'bar', name, data: appointments, color }],
  };
}
