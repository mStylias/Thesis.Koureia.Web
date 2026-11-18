import { categorySet, testContext } from '../../testing/dashboard.fixtures';
import type { TooltipFormatter as Formatter } from '../../testing/dashboard.fixtures.types';
import { isEmptySeriesSet } from './chart-data';
import {
  ratingDistributionOption,
  ratingDistributionSet,
  ratingLabels,
} from './rating-distribution.options';

describe('ratingDistributionOption', () => {
  const ctx = testContext();
  const set = categorySet(
    ['1', '2', '3', '4', '5'].map((key) => ({ key })),
    { reviews: [5, 0, null, 23, 67] },
  );
  const option = ratingDistributionOption(set, ctx);
  const series = option['series'] as Record<string, unknown>[];

  it('puts 5 stars on the left, with star labels', () => {
    expect((option['xAxis'] as { data: string[] }).data).toEqual([
      '5 ★',
      '4 ★',
      '3 ★',
      '2 ★',
      '1 ★',
    ]);
  });

  it('keeps null as nothing and 0 as a zero', () => {
    expect(series[0]).toMatchObject({
      type: 'bar',
      data: [67, 23, null, 0, 5],
      color: 'swatch-1',
    });
  });

  it('keeps the table in the order of the chart', () => {
    const sorted = ratingDistributionSet(set);
    expect(sorted.axis.items.map((item) => item.key)).toEqual(['5', '4', '3', '2', '1']);
    expect(sorted.series[0]?.values).toEqual([67, 23, null, 0, 5]);
    expect(ratingLabels(sorted, ctx)).toEqual(['5 ★', '4 ★', '3 ★', '2 ★', '1 ★']);
  });

  it('counts reviews in the tooltip', () => {
    const formatter = (option['tooltip'] as { formatter: Formatter }).formatter;
    const html = formatter([{ dataIndex: 0, seriesName: 'Κριτικές', value: 67 }]);
    expect(html).toContain('5 ★');
    expect(html).toContain('>67<');
  });

  it('reports a period with no review as empty', () => {
    expect(isEmptySeriesSet(categorySet([{ key: '1' }, { key: '5' }], { reviews: [0, 0] }))).toBe(
      true,
    );
  });
});
