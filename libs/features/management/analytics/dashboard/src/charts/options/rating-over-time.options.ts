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

/**
 * `ratingOverTime`: the average rating as a line on a 1–5 axis, and the number of reviews as
 * bars on a second axis at the right. A bucket with no review has a `null` rating, which is a
 * gap. The buckets follow the appointment date, not the review date.
 */
export function ratingOverTimeOption(set: SeriesSetViewDto, ctx: ChartContext): ChartOption {
  const labels = axisLabels(set, ctx);
  const rating = seriesValues(set, 'averageRating');
  const reviews = seriesValues(set, 'reviews');
  const ratingColor = swatch(ctx, 0);
  const reviewsColor = swatch(ctx, 1);
  const ratingName = seriesName('averageRating', ctx);
  const reviewsName = seriesName('reviews', ctx);

  return {
    ...baseOption(ctx),
    legend: chartLegend([
      { name: ratingName, color: ratingColor },
      { name: reviewsName, color: reviewsColor },
    ]),
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const index = tooltipIndex(params);
        const shown = new Set(tooltipSeries(params).map((param) => param.seriesName));
        const rows: TooltipRow[] = [];
        if (shown.has(ratingName)) {
          rows.push({
            name: ratingName,
            value: ctx.format.tooltip(rating[index], 'Rating'),
            color: ratingColor,
          });
        }
        if (shown.has(reviewsName)) {
          rows.push({
            name: reviewsName,
            value: ctx.format.tooltip(reviews[index], 'Count'),
            color: reviewsColor,
          });
        }
        return tooltipHtml(labels[index] ?? '', rows);
      },
    },
    xAxis: categoryAxis(labels),
    yAxis: [
      valueAxis('Rating', ctx, { min: 1, max: 5, interval: 1 }),
      // Its ticks do not meet the rating's, so it draws no grid lines of its own.
      valueAxis('Count', ctx, { position: 'right', minInterval: 1, splitLine: { show: false } }),
    ],
    series: [
      {
        type: 'bar',
        name: reviewsName,
        yAxisIndex: 1,
        data: reviews,
        color: reviewsColor,
        z: 2,
      },
      {
        type: 'line',
        name: ratingName,
        yAxisIndex: 0,
        data: rating,
        color: ratingColor,
        ...lineMarkers(rating),
        connectNulls: false,
        z: 3,
      },
    ],
  };
}
