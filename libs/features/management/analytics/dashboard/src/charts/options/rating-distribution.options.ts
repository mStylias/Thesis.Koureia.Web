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
import { pickItems, seriesName, seriesValues } from './chart-data';
import type { ChartContext } from './chart-options.types';

/** The set with 5 stars first. The API sends 1 to 5, and the chart reads from the best rating. */
export function ratingDistributionSet(set: SeriesSetViewDto): SeriesSetViewDto {
  const indexes = set.axis.items.map((_, index) => index);
  const stars = (index: number): number => Number(set.axis.items[index]?.key) || 0;
  return pickItems(
    set,
    indexes.sort((a, b) => stars(b) - stars(a)),
  );
}

/** The star labels of a distribution set, "5 ★" to "1 ★", one per item. */
export function ratingLabels(set: SeriesSetViewDto, ctx: ChartContext): string[] {
  return set.axis.items.map((item) =>
    ctx.t('managementDashboard.units.stars', { value: item.key }),
  );
}

/**
 * `ratingDistribution`: one bar per star rating, 5 stars on the left. The bars count reviews.
 */
export function ratingDistributionOption(set: SeriesSetViewDto, ctx: ChartContext): ChartOption {
  const sorted = ratingDistributionSet(set);
  const labels = ratingLabels(sorted, ctx);
  const reviews = seriesValues(sorted, 'reviews');
  const color = swatch(ctx, 0);
  const reviewsName = seriesName('reviews', ctx);

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
            ? [{ name: reviewsName, value: ctx.format.tooltip(reviews[index], 'Count'), color }]
            : [],
        );
      },
    },
    xAxis: { ...categoryAxis(labels), axisLabel: { interval: 0 } },
    yAxis: valueAxis('Count', ctx, { minInterval: 1 }),
    series: [{ type: 'bar', name: reviewsName, data: reviews, color }],
  };
}
