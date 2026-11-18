import { categorySet, testContext } from '../../testing/dashboard.fixtures';
import { bookingSourceOption, sourceColor } from './booking-source.options';
import { readLegend } from './chart-base';
import { isEmptySeriesSet } from './chart-data';

describe('bookingSourceOption', () => {
  const ctx = testContext();

  it('names the sources and gives each its own swatch', () => {
    const option = bookingSourceOption(
      categorySet([{ key: 'online' }, { key: 'staff' }], { appointments: [192, 90] }),
      ctx,
    );
    expect(readLegend(option)).toEqual([
      { name: 'Online', color: 'swatch-1', dashed: false, opacity: 1 },
      { name: 'Από το κατάστημα', color: 'swatch-2', dashed: false, opacity: 1 },
    ]);
  });

  it('keeps a source on its swatch whatever its position', () => {
    const option = bookingSourceOption(
      categorySet([{ key: 'staff' }, { key: 'online' }], { appointments: [90, 192] }),
      ctx,
    );
    expect(readLegend(option).map((item) => item.color)).toEqual(['swatch-2', 'swatch-1']);
    expect(sourceColor('other', ctx, 2)).toBe('swatch-3');
  });

  it('reports no bookings as empty', () => {
    expect(
      isEmptySeriesSet(
        categorySet([{ key: 'online' }, { key: 'staff' }], { appointments: [0, 0] }),
      ),
    ).toBe(true);
  });
});
