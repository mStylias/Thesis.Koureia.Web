import { categorySet, testContext } from '../../testing/dashboard.fixtures';
import { readLegend } from './chart-base';
import { isEmptySeriesSet } from './chart-data';
import { cancelledByOption } from './cancelled-by.options';

describe('cancelledByOption', () => {
  const ctx = testContext();

  it('names the customer and the shop, in the first two swatches', () => {
    const option = cancelledByOption(
      categorySet([{ key: 'customer' }, { key: 'shop' }], { appointments: [6, 11] }),
      ctx,
    );
    expect(readLegend(option)).toEqual([
      { name: 'Πελάτης', color: 'swatch-1', dashed: false, opacity: 1 },
      { name: 'Κατάστημα', color: 'swatch-2', dashed: false, opacity: 1 },
    ]);
  });

  it('draws no slice for a 0, and keeps its swatch for the other', () => {
    const option = cancelledByOption(
      categorySet([{ key: 'customer' }, { key: 'shop' }], { appointments: [0, 11] }),
      ctx,
    );
    expect((option['series'] as { data: unknown[] }[])[0]?.data).toEqual([
      { name: 'Κατάστημα', value: 11, itemStyle: { color: 'swatch-2', opacity: 1 } },
    ]);
  });

  it('reports no cancellations as empty', () => {
    expect(
      isEmptySeriesSet(
        categorySet([{ key: 'customer' }, { key: 'shop' }], { appointments: [0, null] }),
      ),
    ).toBe(true);
  });
});
