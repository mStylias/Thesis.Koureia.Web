import type { TooltipFormatter as Formatter } from '../../testing/dashboard.fixtures.types';
import { categorySet, plainText, testContext } from '../../testing/dashboard.fixtures';
import { isEmptySeriesSet } from './chart-data';
import { ratingPerStaffOption, ratingPerStaffSet } from './rating-per-staff.options';

describe('ratingPerStaffOption', () => {
  const ctx = testContext();
  const set = categorySet(
    [{ label: 'Νίκος Β.' }, { label: 'Παύλος Χ.' }, { label: 'Γιάννης Ρ.' }],
    { averageRating: [4.29, 4.52, null], reviews: [24, 31, 0] },
    { averageRating: 'Rating' },
  );

  const series = () =>
    ratingPerStaffOption(set, ctx)['series'] as { data: unknown[]; silent?: boolean }[];
  const formatter = () =>
    (ratingPerStaffOption(set, ctx)['tooltip'] as { formatter: Formatter }).formatter;

  it('puts the highest on top, and a barber with no review last', () => {
    const yAxis = ratingPerStaffOption(set, ctx)['yAxis'] as { data: string[] };
    expect(yAxis.data).toEqual(['Παύλος Χ.', 'Νίκος Β.', 'Γιάννης Ρ.']);
    expect(ratingPerStaffSet(set).axis.items.map((item) => item.label)).toEqual(yAxis.data);
  });

  it('draws on a 0–5 axis', () => {
    expect(ratingPerStaffOption(set, ctx)['xAxis']).toMatchObject({ min: 0, max: 5 });
  });

  it('draws no bar for null and writes "Χωρίς κριτικές" in its place', () => {
    expect(series()[0]?.data).toEqual([4.52, 4.29, null]);
    expect(series()[1]?.data[2]).toMatchObject({
      value: 0,
      label: { show: true, formatter: 'Χωρίς κριτικές' },
    });
    expect(series()[1]?.data.slice(0, 2)).toEqual([null, null]);
  });

  it('keeps 0 as a zero', () => {
    const zero = categorySet([{ label: 'A' }], { averageRating: [0], reviews: [1] });
    expect((ratingPerStaffOption(zero, ctx)['series'] as { data: unknown[] }[])[0]?.data).toEqual([
      0,
    ]);
  });

  it('adds the reviews to the tooltip, with the star on the rating', () => {
    const html = plainText(formatter()([{ dataIndex: 0 }]));
    expect(html).toContain('4,5 ★');
    expect(html).toContain('Κριτικές');
    expect(html).toContain('31');
    expect(plainText(formatter()([{ dataIndex: 2 }]))).toContain('Χωρίς κριτικές');
  });

  it('reports a set with no barber as empty', () => {
    expect(isEmptySeriesSet(categorySet([], { averageRating: [], reviews: [] }))).toBe(true);
  });
});
