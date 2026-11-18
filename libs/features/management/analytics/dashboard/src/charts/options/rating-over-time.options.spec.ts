import type { SeriesSetViewDto } from '@api/analytics';

import { plainText, testContext, timeSet } from '../../testing/dashboard.fixtures';
import type { TooltipFormatter as Formatter } from '../../testing/dashboard.fixtures.types';
import { readLegend } from './chart-base';
import { isEmptySeriesSet } from './chart-data';
import { ratingOverTimeOption } from './rating-over-time.options';

const BUCKETS = [
  ['2026-07-07', '2026-07-12'],
  ['2026-07-13', '2026-07-19'],
  ['2026-07-20', '2026-07-26'],
] as const;

function ratingSet(
  rating: readonly (number | null)[],
  reviews: readonly (number | null)[],
): SeriesSetViewDto {
  return {
    axis: timeSet(BUCKETS.slice(0, rating.length), {}).axis,
    series: [
      { key: 'averageRating', unit: 'Rating', values: rating },
      { key: 'reviews', unit: 'Count', values: reviews },
    ],
  };
}

describe('ratingOverTimeOption', () => {
  const ctx = testContext();
  const option = ratingOverTimeOption(ratingSet([4.67, null, 3.4], [6, 0, 5]), ctx);
  const series = option['series'] as Record<string, unknown>[];
  const yAxis = option['yAxis'] as Record<string, unknown>[];
  const formatter = (option['tooltip'] as { formatter: Formatter }).formatter;

  it('keeps a bucket with no review as a gap and 0 reviews as a zero', () => {
    expect(series[1]).toMatchObject({
      type: 'line',
      data: [4.67, null, 3.4],
      connectNulls: false,
    });
    expect(series[0]).toMatchObject({ type: 'bar', data: [6, 0, 5] });
  });

  it('draws the rating on a 1–5 axis and the reviews as bars on a second axis', () => {
    expect(yAxis[0]).toMatchObject({ type: 'value', min: 1, max: 5, interval: 1 });
    expect(yAxis[1]).toMatchObject({
      type: 'value',
      position: 'right',
      splitLine: { show: false },
    });
    expect(series[1]).toMatchObject({ yAxisIndex: 0, color: 'swatch-1', z: 3 });
    expect(series[0]).toMatchObject({ yAxisIndex: 1, color: 'swatch-2', z: 2 });
    expect(readLegend(option)).toEqual([
      { name: 'Μέση βαθμολογία', color: 'swatch-1', dashed: false, opacity: 1 },
      { name: 'Κριτικές', color: 'swatch-2', dashed: false, opacity: 1 },
    ]);
  });

  it('marks a lone rating of a long range, which draws nothing without a marker', () => {
    const days = Array.from({ length: 30 }, (_, index): [string, string] => {
      const day = `2026-09-${String(index + 1).padStart(2, '0')}`;
      return [day, day];
    });
    const long = (rating: (number | null)[]): Record<string, unknown> =>
      (
        ratingOverTimeOption(
          {
            axis: timeSet(days, {}, 'Count', 'Day').axis,
            series: [
              { key: 'averageRating', unit: 'Rating', values: rating },
              { key: 'reviews', unit: 'Count', values: rating.map((value) => (value ? 1 : 0)) },
            ],
          },
          ctx,
        )['series'] as Record<string, unknown>[]
      )[1] ?? {};
    expect(long(days.map((_, index) => (index === 2 || index === 5 ? 4.5 : null)))).toMatchObject({
      showSymbol: true,
      showAllSymbol: true,
    });
    expect(long(days.map(() => 4.5))).toMatchObject({ showSymbol: false });
  });

  it('labels a cut week with its real dates', () => {
    expect((option['xAxis'] as { data: string[] }).data[0]).toBe('7–12 Ιουλ');
  });

  it('shows the rating with a star, before the reviews, in the tooltip', () => {
    const html = plainText(
      formatter([
        { dataIndex: 0, seriesName: 'Κριτικές', value: 6 },
        { dataIndex: 0, seriesName: 'Μέση βαθμολογία', value: 4.67 },
      ]),
    );
    expect(html).toContain('4,7 ★');
    expect(html.indexOf('Μέση βαθμολογία')).toBeLessThan(html.indexOf('Κριτικές'));
  });

  it('shows a missing rating as a dash and 0 reviews as a zero in the tooltip', () => {
    const html = formatter([
      { dataIndex: 1, seriesName: 'Κριτικές', value: 0 },
      { dataIndex: 1, seriesName: 'Μέση βαθμολογία', value: null },
    ]);
    expect(html).toContain('>—<');
    expect(html).toContain('>0<');
  });

  it('leaves a hidden series out of the tooltip', () => {
    const html = formatter([{ dataIndex: 2, seriesName: 'Μέση βαθμολογία', value: 3.4 }]);
    expect(html).not.toContain('Κριτικές');
  });

  it('reports a period with no review as empty', () => {
    expect(isEmptySeriesSet(ratingSet([null], [0]))).toBe(true);
  });
});
