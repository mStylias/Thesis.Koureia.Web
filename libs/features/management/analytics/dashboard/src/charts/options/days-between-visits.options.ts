import type { SeriesSetViewDto } from '@api/analytics';
import type { ChartOption } from '@ui/chart';

import {
  baseOption,
  categoryAxis,
  tooltipHtml,
  tooltipIndex,
  tooltipSeries,
  valueAxis,
} from './chart-base';
import { swatch } from './chart-colors';
import { axisLabels, seriesName, seriesValues } from './chart-data';
import type { ChartContext } from './chart-options.types';

/**
 * `daysBetweenVisits`: one bar per day band, "1–14 ημέρες" to "91+ ημέρες", in the order of the
 * API. The bars count visits, not customers.
 */
export function daysBetweenVisitsOption(set: SeriesSetViewDto, ctx: ChartContext): ChartOption {
  const labels = axisLabels(set, ctx);
  const visits = seriesValues(set, 'visits');
  const color = swatch(ctx, 0);
  const visitsName = seriesName('visits', ctx);
  const axis = categoryAxis(labels);

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
          shown
            ? [{ name: visitsName, value: ctx.format.tooltip(visits[index], 'Count'), color }]
            : [],
        );
      },
    },
    // Every band keeps its label. The axis shows the range only: the heading names the unit, and
    // the tooltip and the table keep the full label.
    xAxis: {
      ...axis,
      axisLabel: {
        ...(axis['axisLabel'] as Record<string, unknown>),
        interval: 0,
        hideOverlap: false,
        formatter: (value: string) => value.split(' ').at(0) ?? value,
      },
    },
    yAxis: valueAxis('Count', ctx, { minInterval: 1 }),
    series: [{ type: 'bar', name: visitsName, data: visits, color }],
  };
}
