import type { SeriesSetViewDto } from '@api/analytics';
import type { ChartOption } from '@ui/chart';

import { baseOption, categoryAxis, tooltipHtml, tooltipIndex, valueAxis } from './chart-base';
import { swatch } from './chart-colors';
import {
  axisLabels,
  indexesByValue,
  pickItems,
  seriesName,
  seriesValues,
  topLevelSet,
} from './chart-data';
import type { ChartContext } from './chart-options.types';

/**
 * The categories of `revenuePerService`, the items with no parent, largest first. The card's
 * table and its empty check read this set, so they show what the chart shows.
 */
export function revenuePerCategorySet(set: SeriesSetViewDto): SeriesSetViewDto {
  const categories = topLevelSet(set);
  return pickItems(categories, indexesByValue(seriesValues(categories, 'revenue')));
}

/**
 * `revenuePerService` on the Revenue tab: one horizontal bar per category. The Services tab
 * draws the same data as a treemap. The key `uncategorized` reads "Χωρίς κατηγορία".
 */
export function revenuePerCategoryOption(set: SeriesSetViewDto, ctx: ChartContext): ChartOption {
  const categories = revenuePerCategorySet(set);
  const labels = axisLabels(categories, ctx);
  const revenue = seriesValues(categories, 'revenue');
  const color = swatch(ctx, 0);
  const revenueName = seriesName('revenue', ctx);

  return {
    ...baseOption(ctx),
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: unknown) => {
        const index = tooltipIndex(params);
        return tooltipHtml(labels[index] ?? '', [
          { name: revenueName, value: ctx.format.tooltip(revenue[index], 'Money'), color },
        ]);
      },
    },
    xAxis: valueAxis('Money', ctx),
    yAxis: { ...categoryAxis(labels), inverse: true },
    series: [{ type: 'bar', name: revenueName, data: revenue, color }],
  };
}
