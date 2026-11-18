import type { SeriesSetViewDto } from '@api/analytics';
import type { ChartOption } from '@ui/chart';

import {
  baseOption,
  categoryAxis,
  chartLegend,
  lineMarkers,
  tooltipHtml,
  tooltipIndex,
  tooltipSeries,
  valueAxis,
} from './chart-base';
import { swatch } from './chart-colors';
import { axisLabels, seriesName, seriesValues } from './chart-data';
import type { ChartContext, TooltipRow } from './chart-options.types';

/** The series of the chart, in swatch order. */
const RATE_KEYS: readonly string[] = ['cancellationRate', 'noShowRate'];

/**
 * `lostRateOverTime`: the cancellation rate and the no-show rate per time bucket, 0 to 100. A
 * `null` bucket had nothing resolved, so it is a gap, and `0` is a zero.
 */
export function lostRateOverTimeOption(set: SeriesSetViewDto, ctx: ChartContext): ChartOption {
  const labels = axisLabels(set, ctx);
  const lines = RATE_KEYS.map((key, index) => ({
    name: seriesName(key, ctx),
    color: swatch(ctx, index),
    values: seriesValues(set, key),
  }));

  return {
    ...baseOption(ctx),
    legend: chartLegend(lines.map((line) => ({ name: line.name, color: line.color }))),
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const index = tooltipIndex(params);
        const rows = tooltipSeries(params).map((param): TooltipRow => ({
          name: param.seriesName,
          value: ctx.format.tooltip(
            typeof param.value === 'number' ? param.value : null,
            'Percent',
          ),
          color: param.color,
        }));
        return tooltipHtml(labels[index] ?? '', rows);
      },
    },
    xAxis: { ...categoryAxis(labels), boundaryGap: false },
    yAxis: valueAxis('Percent', ctx, { min: 0 }),
    series: lines.map((line) => ({
      type: 'line',
      name: line.name,
      data: line.values,
      color: line.color,
      ...lineMarkers(line.values),
      connectNulls: false,
    })),
  };
}
