import { APPOINTMENT_STATUS_SPECS } from '@features/management-shared-appointments';

import type { TooltipFormatter as Formatter } from '../../testing/dashboard.fixtures.types';
import { categorySet, testContext } from '../../testing/dashboard.fixtures';
import { appointmentsPerStaffOption } from './appointments-per-staff.options';
import { readLegend } from './chart-base';
import { MUTED_OPACITY } from './chart-colors';
import { isEmptySeriesSet } from './chart-data';

describe('appointmentsPerStaffOption', () => {
  const ctx = testContext();
  const set = categorySet(
    [{ label: 'Αλέξανδρος Σ.' }, { label: 'Νίκος Β.' }, { label: 'Γιάννης Ρ.' }],
    {
      completed: [89, 79, 25],
      confirmed: [4, 0, null],
      pending: [0, 0, 0],
      cancelled: [7, 4, 4],
      no_show: [3, 5, 2],
    },
  );

  const bars = () =>
    appointmentsPerStaffOption(set, ctx)['series'] as {
      name: string;
      stack: string;
      data: (number | null)[];
      itemStyle: { color: string; opacity: number };
    }[];

  it('keeps the server order, the first barber on top', () => {
    const yAxis = appointmentsPerStaffOption(set, ctx)['yAxis'] as {
      data: string[];
      inverse: boolean;
    };
    expect(yAxis.data).toEqual(['Αλέξανδρος Σ.', 'Νίκος Β.', 'Γιάννης Ρ.']);
    expect(yAxis.inverse).toBe(true);
  });

  it('stacks one bar per status in its tone, and leaves out a status with no appointment', () => {
    expect(bars().map((bar) => bar.name)).toEqual([
      'managementAppointments.status.completed',
      'managementAppointments.status.confirmed',
      'managementAppointments.status.cancelled',
      'managementAppointments.status.no_show',
    ]);
    expect(new Set(bars().map((bar) => bar.stack)).size).toBe(1);
    expect(bars().map((bar) => bar.itemStyle)).toEqual([
      { color: 'success', opacity: 1 },
      { color: 'info', opacity: 1 },
      { color: 'text-muted', opacity: MUTED_OPACITY },
      { color: 'error', opacity: MUTED_OPACITY },
    ]);
    expect(APPOINTMENT_STATUS_SPECS.cancelled.tone).toBe('neutral');
  });

  it('lists the drawn statuses in the legend', () => {
    expect(readLegend(appointmentsPerStaffOption(set, ctx)).map((item) => item.name)).toEqual(
      bars().map((bar) => bar.name),
    );
  });

  it('keeps null as a gap and 0 as a zero', () => {
    expect(bars()[1]?.data).toEqual([4, 0, null]);
  });

  it('lists the shown statuses in the tooltip', () => {
    const html = (
      appointmentsPerStaffOption(set, ctx)['tooltip'] as { formatter: Formatter }
    ).formatter([
      {
        dataIndex: 1,
        seriesName: 'managementAppointments.status.completed',
        value: 79,
        color: 'success',
      },
      {
        dataIndex: 1,
        seriesName: 'managementAppointments.status.no_show',
        value: 5,
        color: 'error',
      },
    ]);
    expect(html).toContain('Νίκος Β.');
    expect(html).toContain('79');
    expect(html).toContain('managementAppointments.status.no_show');
  });

  it('reports a set with no barber, or only zeros, as empty', () => {
    expect(isEmptySeriesSet(categorySet([], { completed: [] }))).toBe(true);
    expect(isEmptySeriesSet(categorySet([{}], { completed: [0], cancelled: [null] }))).toBe(true);
  });
});
