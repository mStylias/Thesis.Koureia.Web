import type { TooltipFormatter as Formatter } from '../../testing/dashboard.fixtures.types';
import { categorySet, plainText, testContext } from '../../testing/dashboard.fixtures';
import { isEmptySeriesSet } from './chart-data';
import { staffUtilizationOption, staffUtilizationSet } from './staff-utilization.options';

describe('staffUtilizationOption', () => {
  const ctx = testContext();
  const set = categorySet(
    [
      { label: 'Γιάννης Ρ.' },
      { label: 'Παύλος Χ.' },
      { label: 'Αλέξανδρος Σ.' },
      { label: 'Νίκος Β.' },
    ],
    {
      utilization: [null, 8.9, 13.56, 0],
      bookedMinutes: [945, 2055, 3620, 0],
      availableMinutes: [0, 23100, 26700, 2400],
    },
    { utilization: 'Percent', bookedMinutes: 'Minutes', availableMinutes: 'Minutes' },
  );

  const series = () =>
    staffUtilizationOption(set, ctx)['series'] as {
      name: string;
      data: unknown[];
      silent?: boolean;
    }[];
  const formatter = () =>
    (staffUtilizationOption(set, ctx)['tooltip'] as { formatter: Formatter }).formatter;

  it('puts the highest on top, and a barber with no working hours last', () => {
    const yAxis = staffUtilizationOption(set, ctx)['yAxis'] as { data: string[]; inverse: boolean };
    expect(yAxis.data).toEqual(['Αλέξανδρος Σ.', 'Παύλος Χ.', 'Νίκος Β.', 'Γιάννης Ρ.']);
    expect(yAxis.inverse).toBe(true);
    expect(staffUtilizationSet(set).axis.items.map((item) => item.label)).toEqual(yAxis.data);
  });

  it('draws on a 0–100 % axis, with no 100 % line', () => {
    const xAxis = staffUtilizationOption(set, ctx)['xAxis'] as {
      min: number;
      max: (extent: { max: number }) => number;
    };
    expect(xAxis.min).toBe(0);
    expect(xAxis.max({ max: 13.56 })).toBe(100);
    expect(series()[0]).not.toHaveProperty('markLine');
  });

  it('grows the axis past 100 % when booked time is more than scheduled, and marks 100 %', () => {
    const over = categorySet(
      [{ label: 'Γιάννης Ρ.' }, { label: 'Παύλος Χ.' }],
      { utilization: [150, 100], bookedMinutes: [900, 600], availableMinutes: [600, 600] },
      { utilization: 'Percent', bookedMinutes: 'Minutes', availableMinutes: 'Minutes' },
    );
    const option = staffUtilizationOption(over, ctx);
    const xAxis = option['xAxis'] as { max: (extent: { max: number }) => number };
    expect(xAxis.max({ max: 150 })).toBe(150);
    expect(xAxis.max({ max: 143.2 })).toBe(150);
    expect((option['series'] as Record<string, unknown>[])[0]).toMatchObject({
      data: [150, 100],
      markLine: { data: [{ xAxis: 100 }] },
    });
  });

  it('keeps null as a gap and 0 as a zero', () => {
    expect(series()[0]?.data).toEqual([13.56, 8.9, 0, null]);
  });

  it('writes "Χωρίς ωράριο" where there is no bar, and only there', () => {
    const labels = series()[1];
    expect(labels.silent).toBe(true);
    expect(labels.data.slice(0, 3)).toEqual([null, null, null]);
    expect(labels.data[3]).toMatchObject({
      value: 0,
      label: { show: true, formatter: 'Χωρίς ωράριο', color: 'text-muted' },
    });
  });

  it('gives the booked and the available time in hours', () => {
    const html = plainText(formatter()([{ dataIndex: 0 }]));
    expect(html).toContain('Αλέξανδρος Σ.');
    expect(html).toContain('13,6%');
    expect(html).toContain('60,3 / 445 ώρες');
  });

  it('says "Χωρίς ωράριο" in the tooltip of a barber with no working hours', () => {
    const html = plainText(formatter()([{ dataIndex: 3 }]));
    expect(html).toContain('Χωρίς ωράριο');
    expect(html).toContain('15,8 / 0 ώρες');
  });

  it('reports a set with no barber as empty', () => {
    expect(isEmptySeriesSet(categorySet([], { utilization: [] }))).toBe(true);
  });
});
