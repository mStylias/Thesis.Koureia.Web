import { APPOINTMENT_STATUS_SPECS } from '@features/management-shared-appointments';

import { testContext, timeSet } from '../../testing/dashboard.fixtures';
import type { TooltipFormatter as Formatter } from '../../testing/dashboard.fixtures.types';
import { appointmentsByStatusOption } from './appointments-by-status.options';
import { readLegend } from './chart-base';
import { MUTED_OPACITY } from './chart-colors';
import { isEmptySeriesSet } from './chart-data';

describe('appointmentsByStatusOption', () => {
  const ctx = testContext();
  const set = timeSet(
    [
      ['2026-07-07', '2026-07-12'],
      ['2026-07-13', '2026-07-19'],
    ],
    {
      completed: [21, null],
      confirmed: [0, 4],
      pending: [0, 0],
      cancelled: [2, 0],
      no_show: [null, 1],
    },
    'Count',
  );
  const option = appointmentsByStatusOption(set, ctx);
  const series = option['series'] as Record<string, unknown>[];

  it('stacks one bar per status that has a value, and keeps null and 0 apart', () => {
    expect(series.map((item) => item['name'])).toEqual([
      'managementAppointments.status.completed',
      'managementAppointments.status.confirmed',
      'managementAppointments.status.cancelled',
      'managementAppointments.status.no_show',
    ]);
    expect(series[0]).toMatchObject({ type: 'bar', stack: 'status', data: [21, null] });
    expect(series[2]).toMatchObject({ data: [2, 0] });
  });

  it('colors each status by its tone, as APPOINTMENT_STATUS_SPECS says', () => {
    expect(APPOINTMENT_STATUS_SPECS.completed.tone).toBe('success');
    expect(series[0]).toMatchObject({ itemStyle: { color: 'success', opacity: 1 } });
    expect(series[1]).toMatchObject({ itemStyle: { color: 'info', opacity: 1 } });
    expect(series[2]).toMatchObject({ itemStyle: { color: 'text-muted', opacity: MUTED_OPACITY } });
    expect(series[3]).toMatchObject({ itemStyle: { color: 'error', opacity: MUTED_OPACITY } });
  });

  it('leaves a status with only zeros out of the legend', () => {
    const names = readLegend(option).map((item) => item.name);
    expect(names).not.toContain('managementAppointments.status.pending');
    expect(names).toHaveLength(4);
  });

  it('labels a cut week with its real dates', () => {
    expect((option['xAxis'] as { data: string[] }).data).toEqual(['7–12 Ιουλ', '13–19 Ιουλ']);
  });

  it('lists the shown statuses in the tooltip', () => {
    const formatter = (option['tooltip'] as { formatter: Formatter }).formatter;
    const html = formatter([
      { dataIndex: 1, seriesName: 'managementAppointments.status.confirmed', value: 4 },
      { dataIndex: 1, seriesName: 'managementAppointments.status.no_show', value: 1 },
    ]);
    expect(html).toContain('13–19 Ιουλ');
    expect(html).toContain('managementAppointments.status.confirmed');
    expect(html).toContain('4');
  });

  it('reports a set of zeros as empty', () => {
    expect(isEmptySeriesSet(timeSet([['2026-07-07', '2026-07-12']], { completed: [0] }))).toBe(
      true,
    );
  });
});
