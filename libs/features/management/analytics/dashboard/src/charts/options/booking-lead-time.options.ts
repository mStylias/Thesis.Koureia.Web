import type { SeriesSetViewDto } from '@api/analytics';
import type { ChartOption } from '@ui/chart';

import { sourceColor } from './booking-source.options';
import {
  baseOption,
  categoryAxis,
  chartLegend,
  tooltipHtml,
  tooltipIndex,
  tooltipSeries,
  valueAxis,
} from './chart-base';
import { axisLabels, hasValue, seriesName, seriesValues } from './chart-data';
import type { ChartContext, TooltipRow } from './chart-options.types';

/**
 * `bookingLeadTime`: how many days before the appointment it was booked, one horizontal bar per
 * day band, online and by the shop stacked. The shortest band is on top. A source with every
 * value `0` or `null` is left out of the legend.
 */
export function bookingLeadTimeOption(set: SeriesSetViewDto, ctx: ChartContext): ChartOption {
  const labels = axisLabels(set, ctx);
  const shown = set.series
    .map((series, index) => ({
      key: series.key,
      name: seriesName(series.key, ctx),
      color: sourceColor(series.key, ctx, index),
      values: seriesValues(set, series.key),
    }))
    .filter((series) => series.values.some(hasValue));

  return {
    ...baseOption(ctx),
    legend: chartLegend(shown.map((series) => ({ name: series.name, color: series.color }))),
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: unknown) => {
        const index = tooltipIndex(params);
        const rows = tooltipSeries(params).map((param): TooltipRow => ({
          name: param.seriesName,
          value: ctx.format.tooltip(typeof param.value === 'number' ? param.value : null, 'Count'),
          color: param.color,
        }));
        return tooltipHtml(labels[index] ?? '', rows);
      },
    },
    xAxis: valueAxis('Count', ctx, { minInterval: 1 }),
    // Inverse, so the first band, the same day, is on top.
    yAxis: { ...categoryAxis(labels), inverse: true },
    series: shown.map((series) => ({
      type: 'bar',
      name: series.name,
      stack: 'source',
      data: series.values,
      color: series.color,
      emphasis: { focus: 'series' },
    })),
  };
}
