import type { TooltipFormatter as Formatter } from '../../testing/dashboard.fixtures.types';
import { categorySet, testContext } from '../../testing/dashboard.fixtures';
import { isEmptySeriesSet } from './chart-data';
import { revenuePerStaffOption, revenuePerStaffSet } from './revenue-per-staff.options';

describe('revenuePerStaffOption', () => {
  const ctx = testContext();
  const set = categorySet(
    [
      { key: 'a', label: 'Παύλος Χ.' },
      { key: 'b', label: 'Αλέξανδρος Σ.' },
      { key: 'c', label: 'Γιάννης Ρ.' },
    ],
    { revenue: [1147, 1848, 0], completedAppointments: [71, 89, 0] },
    { revenue: 'Money' },
  );

  it('puts the largest on top, with the server names on the axis', () => {
    const option = revenuePerStaffOption(set, ctx);
    const yAxis = option['yAxis'] as { data: string[]; inverse: boolean };
    expect(yAxis.data).toEqual(['Αλέξανδρος Σ.', 'Παύλος Χ.', 'Γιάννης Ρ.']);
    expect(yAxis.inverse).toBe(true);
    expect((option['series'] as { data: unknown[] }[])[0]?.data).toEqual([1848, 1147, 0]);
  });

  it('adds the completed appointments to the tooltip', () => {
    const option = revenuePerStaffOption(set, ctx);
    const html = (option['tooltip'] as { formatter: Formatter }).formatter([
      { dataIndex: 0, seriesName: 'Έσοδα', value: 1848 },
    ]);
    expect(html).toContain('Ολοκληρωμένα ραντεβού');
    expect(html).toContain('89');
  });

  it('keeps the table in the order of the chart', () => {
    expect(revenuePerStaffSet(set).axis.items.map((item) => item.key)).toEqual(['b', 'a', 'c']);
  });

  it('reports a set of zeros as empty', () => {
    expect(isEmptySeriesSet(categorySet([{}], { revenue: [0], completedAppointments: [0] }))).toBe(
      true,
    );
  });
});
