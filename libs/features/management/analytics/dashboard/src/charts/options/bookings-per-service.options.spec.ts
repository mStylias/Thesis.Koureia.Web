import type { TooltipFormatter as Formatter } from '../../testing/dashboard.fixtures.types';
import { categorySet, testContext } from '../../testing/dashboard.fixtures';
import { readLegend } from './chart-base';
import {
  bookingsPerServiceOption,
  bookingsPerServiceSet,
  categorySwatches,
  serviceLabels,
} from './bookings-per-service.options';
import { isEmptySeriesSet } from './chart-data';

describe('bookingsPerServiceOption', () => {
  const ctx = testContext();
  const set = categorySet(
    [
      { key: 'cut', label: 'Κουρέματα' },
      { key: 'classic', label: 'Κλασικό', parentKey: 'cut' },
      { key: 'fade', label: 'Fade', parentKey: 'cut' },
      { key: 'beard', label: 'Γενειάδα' },
      { key: 'trim', label: 'Περιποίηση', parentKey: 'beard' },
      { key: 'shave', label: 'Ξύρισμα', parentKey: 'beard' },
      { key: 'uncategorized' },
      { key: 'kids', label: 'Παιδικό', parentKey: 'uncategorized' },
    ],
    { bookings: [155, 117, 38, 121, 106, null, 0, 0] },
  );

  const series = () =>
    bookingsPerServiceOption(set, ctx)['series'] as {
      name: string;
      stack: string;
      color: string;
      data: (number | null)[];
    }[];

  it('draws only the services, most booked first and on top', () => {
    const yAxis = bookingsPerServiceOption(set, ctx)['yAxis'] as {
      data: string[];
      inverse: boolean;
    };
    expect(yAxis.data).toEqual(['Κλασικό', 'Περιποίηση', 'Fade', 'Παιδικό', 'Ξύρισμα']);
    expect(yAxis.inverse).toBe(true);
    expect(bookingsPerServiceSet(set).axis.items.map((item) => item.key)).toEqual([
      'classic',
      'trim',
      'fade',
      'kids',
      'shave',
    ]);
  });

  it('gives each category its swatch, with a value only on its own services', () => {
    expect(series().map((item) => [item.name, item.color])).toEqual([
      ['Κουρέματα', 'swatch-1'],
      ['Γενειάδα', 'swatch-2'],
      ['Χωρίς κατηγορία', 'swatch-3'],
    ]);
    expect(series()[0]?.data).toEqual([117, null, 38, null, null]);
    expect(series()[1]?.data).toEqual([null, 106, null, null, null]);
    expect(new Set(series().map((item) => item.stack)).size).toBe(1);
  });

  it('keeps null as a gap and 0 as a zero', () => {
    expect(series()[2]?.data).toEqual([null, null, null, 0, null]);
  });

  it('lists the categories in the legend', () => {
    expect(readLegend(bookingsPerServiceOption(set, ctx))).toEqual([
      { name: 'Κουρέματα', color: 'swatch-1', dashed: false, opacity: 1 },
      { name: 'Γενειάδα', color: 'swatch-2', dashed: false, opacity: 1 },
      { name: 'Χωρίς κατηγορία', color: 'swatch-3', dashed: false, opacity: 1 },
    ]);
  });

  it('takes the colors it is given, so both charts of the tab agree', () => {
    const colors = new Map([
      ['beard', 'swatch-4'],
      ['cut', 'swatch-5'],
    ]);
    expect(bookingsPerServiceOption(set, ctx, colors)['series']).toMatchObject([
      { name: 'Κουρέματα', color: 'swatch-5' },
      { name: 'Γενειάδα', color: 'swatch-4' },
      { name: 'Χωρίς κατηγορία' },
    ]);
  });

  it('repeats the swatches after six categories', () => {
    const many = categorySet(
      Array.from({ length: 7 }, (_, index) => ({ key: `c${index}` })),
      { bookings: Array.from({ length: 7 }, () => 1) },
    );
    expect(categorySwatches(many, ctx).get('c6')).toBe('swatch-1');
  });

  it('names the service with its category in the tooltip and the table', () => {
    const html = (
      bookingsPerServiceOption(set, ctx)['tooltip'] as { formatter: Formatter }
    ).formatter([{ dataIndex: 0, seriesName: 'Κουρέματα', value: 117 }]);
    expect(html).toContain('Κλασικό (Κουρέματα)');
    expect(html).toContain('117');
    expect(serviceLabels(bookingsPerServiceSet(set).axis.items, set, ctx)).toEqual([
      'Κλασικό (Κουρέματα)',
      'Περιποίηση (Γενειάδα)',
      'Fade (Κουρέματα)',
      'Παιδικό (Χωρίς κατηγορία)',
      'Ξύρισμα (Γενειάδα)',
    ]);
  });

  it('drops the value from the tooltip of a category turned off in the legend', () => {
    const html = (
      bookingsPerServiceOption(set, ctx)['tooltip'] as { formatter: Formatter }
    ).formatter([{ dataIndex: 0, seriesName: 'Γενειάδα', value: null }]);
    expect(html).not.toContain('117');
  });

  it('reports services of zeros as empty', () => {
    const zeros = categorySet([{ key: 'cut' }, { key: 'x', parentKey: 'cut' }], {
      bookings: [0, 0],
    });
    expect(isEmptySeriesSet(bookingsPerServiceSet(zeros))).toBe(true);
  });
});
