import { categorySet, testContext } from '../../testing/dashboard.fixtures';
import { isEmptySeriesSet } from './chart-data';
import { revenuePerCategoryOption, revenuePerCategorySet } from './revenue-per-category.options';

describe('revenuePerCategoryOption', () => {
  const ctx = testContext();
  const set = categorySet(
    [
      { key: 'cut', label: 'Κουρέματα' },
      { key: 'classic', label: 'Κλασικό', parentKey: 'cut' },
      { key: 'uncategorized' },
      { key: 'kids', label: 'Παιδικό', parentKey: 'uncategorized' },
      { key: 'beard', label: 'Γενειάδα' },
    ],
    { revenue: [3060, 3060, 225, 225, 1568] },
    { revenue: 'Money' },
  );

  it('draws only the categories, largest first, and names the uncategorized one', () => {
    const option = revenuePerCategoryOption(set, ctx);
    expect((option['yAxis'] as { data: string[] }).data).toEqual([
      'Κουρέματα',
      'Γενειάδα',
      'Χωρίς κατηγορία',
    ]);
    expect((option['series'] as { data: unknown[] }[])[0]?.data).toEqual([3060, 1568, 225]);
  });

  it('gives the card the categories only, so the table matches the chart', () => {
    expect(revenuePerCategorySet(set).axis.items.map((item) => item.key)).toEqual([
      'cut',
      'beard',
      'uncategorized',
    ]);
  });

  it('reports categories of zeros as empty', () => {
    const zeros = categorySet([{ key: 'cut' }, { key: 'x', parentKey: 'cut' }], {
      revenue: [0, 0],
    });
    expect(isEmptySeriesSet(revenuePerCategorySet(zeros))).toBe(true);
  });
});
