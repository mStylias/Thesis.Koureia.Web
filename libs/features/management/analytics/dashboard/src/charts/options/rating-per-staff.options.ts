import type { SeriesSetViewDto } from '@api/analytics';
import type { ChartOption } from '@ui/chart';

import { baseOption, categoryAxis, tooltipHtml, tooltipIndex, valueAxis } from './chart-base';
import { swatch } from './chart-colors';
import { axisLabels, indexesByValue, pickItems, seriesName, seriesValues } from './chart-data';
import type { ChartContext } from './chart-options.types';
import { noValueLabels } from './staff-utilization.options';

/** The set ordered by average rating, highest first. A barber with no review is last. */
export function ratingPerStaffSet(set: SeriesSetViewDto): SeriesSetViewDto {
  return pickItems(set, indexesByValue(seriesValues(set, 'averageRating')));
}

/**
 * `ratingPerStaff`: one horizontal bar per barber on a 0–5 axis. A barber with no review has
 * `null`: no bar, and "Χωρίς κριτικές" in its place. The tooltip adds the number of reviews.
 */
export function ratingPerStaffOption(set: SeriesSetViewDto, ctx: ChartContext): ChartOption {
  const sorted = ratingPerStaffSet(set);
  const labels = axisLabels(sorted, ctx);
  const rating = seriesValues(sorted, 'averageRating');
  const reviews = seriesValues(sorted, 'reviews');
  const color = swatch(ctx, 0);
  const ratingName = seriesName('averageRating', ctx);
  const noReviews = ctx.t('managementDashboard.charts.team.ratingPerStaff.noReviews');

  return {
    ...baseOption(ctx),
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: unknown) => {
        const index = tooltipIndex(params);
        const value = rating[index] ?? null;
        return tooltipHtml(labels[index] ?? '', [
          {
            name: ratingName,
            value: value === null ? noReviews : ctx.format.tooltip(value, 'Rating'),
            color,
          },
          {
            name: seriesName('reviews', ctx),
            value: ctx.format.tooltip(reviews[index] ?? 0, 'Count'),
          },
        ]);
      },
    },
    xAxis: valueAxis('Rating', ctx, { min: 0, max: 5, interval: 1 }),
    yAxis: { ...categoryAxis(labels), inverse: true },
    series: [
      { type: 'bar', name: ratingName, data: rating, color, barGap: '-100%' },
      noValueLabels(rating, noReviews, ctx),
    ],
  };
}
