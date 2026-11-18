import type { SeriesSetViewDto } from '@api/analytics';
import type { ChartOption } from '@ui/chart';

import {
  baseOption,
  categoryAxis,
  chartLegend,
  tooltipHtml,
  tooltipIndex,
  tooltipSeries,
  valueAxis,
} from './chart-base';
import { swatch } from './chart-colors';
import { axisLabels, seriesName, seriesValues } from './chart-data';
import type { ChartContext, TooltipRow } from './chart-options.types';

/** The stack from the axis up. New customers sit on the axis, so their trend reads straight. */
const STACK_KEYS = ['new', 'returning'] as const;

/**
 * `newVsReturning`: one stacked bar per bucket, new customers below and returning ones above,
 * each in its own swatch. A `null` bucket draws nothing.
 */
export function newVsReturningOption(set: SeriesSetViewDto, ctx: ChartContext): ChartOption {
  const labels = axisLabels(set, ctx);
  const series = STACK_KEYS.map((key, index) => ({
    key,
    name: seriesName(key, ctx),
    color: swatch(ctx, index),
    values: seriesValues(set, key),
  }));

  return {
    ...baseOption(ctx),
    legend: chartLegend(series.map(({ name, color }) => ({ name, color }))),
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: unknown) => {
        const index = tooltipIndex(params);
        const shown = new Set(tooltipSeries(params).map((param) => param.seriesName));
        const rows = series
          .filter((item) => shown.has(item.name))
          .map((item): TooltipRow => ({
            name: item.name,
            value: ctx.format.tooltip(item.values[index] ?? null, 'Count'),
            color: item.color,
          }));
        return tooltipHtml(labels[index] ?? '', rows);
      },
    },
    xAxis: categoryAxis(labels),
    yAxis: valueAxis('Count', ctx, { minInterval: 1 }),
    series: series.map((item) => ({
      type: 'bar',
      name: item.name,
      stack: 'customers',
      data: item.values,
      color: item.color,
      emphasis: { focus: 'series' },
    })),
  };
}
