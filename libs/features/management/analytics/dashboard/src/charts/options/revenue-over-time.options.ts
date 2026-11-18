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
import { axisLabels, comparisonBuckets, seriesName, seriesValues } from './chart-data';
import type { ChartContext, TooltipRow } from './chart-options.types';

/**
 * `revenueOverTime`: revenue as a solid line with an area, the comparison as a dashed line of
 * the same swatch. A `null` bucket is a gap. The tooltip gives each value its own dates: the
 * comparison bucket's dates come from its position in the comparison range.
 */
export function revenueOverTimeOption(set: SeriesSetViewDto, ctx: ChartContext): ChartOption {
  const labels = axisLabels(set, ctx);
  const color = swatch(ctx, 0);
  const revenueName = seriesName('revenue', ctx);
  const previousName = seriesName('previous', ctx);
  const previousBuckets = comparisonBuckets(ctx.period);
  const revenue = seriesValues(set, 'revenue');
  const previous = seriesValues(set, 'previous');

  return {
    ...baseOption(ctx),
    legend: chartLegend([
      { name: revenueName, color },
      { name: previousName, color, dashed: true },
    ]),
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const index = tooltipIndex(params);
        const rows = tooltipSeries(params).map((param): TooltipRow => {
          const previous = param.seriesName === previousName;
          const bucket = previous ? previousBuckets[index] : undefined;
          return {
            name: bucket
              ? ctx.t('managementDashboard.tooltip.previous', {
                  name: previousName,
                  dates: ctx.format.span(bucket.fromDate, bucket.toDate),
                })
              : param.seriesName,
            value: ctx.format.tooltip(
              typeof param.value === 'number' ? param.value : null,
              'Money',
            ),
            color,
            dashed: previous,
          };
        });
        return tooltipHtml(labels[index] ?? '', rows);
      },
    },
    xAxis: { ...categoryAxis(labels), boundaryGap: false },
    yAxis: valueAxis('Money', ctx),
    series: [
      {
        type: 'line',
        name: revenueName,
        data: revenue,
        color,
        ...lineMarkers(revenue),
        connectNulls: false,
        areaStyle: { opacity: 0.12 },
        z: 3,
      },
      {
        type: 'line',
        name: previousName,
        data: previous,
        color,
        // The comparison gets markers only when a lone value needs them.
        ...lineMarkers(previous, Infinity),
        connectNulls: false,
        lineStyle: { type: 'dashed' },
        z: 2,
      },
    ],
  };
}
